ALTER TABLE public.sales ADD COLUMN payment_type text NOT NULL DEFAULT 'credit', ADD COLUMN import_job_id uuid REFERENCES public.import_jobs(id);
ALTER TABLE public.customers ADD COLUMN import_job_id uuid REFERENCES public.import_jobs(id);
ALTER TABLE public.customer_payments ADD COLUMN import_job_id uuid REFERENCES public.import_jobs(id);
ALTER TABLE public.product_cost_history ADD COLUMN import_job_id uuid REFERENCES public.import_jobs(id), ADD COLUMN is_void boolean NOT NULL DEFAULT false;
ALTER TABLE public.customer_price_history ADD COLUMN import_job_id uuid REFERENCES public.import_jobs(id), ADD COLUMN is_void boolean NOT NULL DEFAULT false;
ALTER TABLE public.market_prices ADD COLUMN import_job_id uuid REFERENCES public.import_jobs(id), ADD COLUMN is_void boolean NOT NULL DEFAULT false;
ALTER TABLE public.import_jobs ADD COLUMN reversed_at timestamptz, ADD COLUMN reversed_by uuid;
CREATE TABLE public.payment_allocations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payment_id uuid NOT NULL REFERENCES public.customer_payments(id), sale_id uuid NOT NULL REFERENCES public.sales(id), amount numeric(14,2) NOT NULL, created_by uuid DEFAULT auth.uid(), created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.payment_allocations TO authenticated;
GRANT ALL ON public.payment_allocations TO service_role;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance reads allocations" ON public.payment_allocations FOR SELECT TO authenticated USING (public.is_finance(auth.uid()));
CREATE OR REPLACE VIEW public.v_invoice_balances WITH (security_invoker=true) AS
SELECT s.*, greatest(0,s.total_amount-coalesce(a.allocated,0)) AS unpaid, coalesce(a.allocated,0) AS allocated FROM public.sales s LEFT JOIN (SELECT pa.sale_id,sum(pa.amount) allocated FROM public.payment_allocations pa JOIN public.customer_payments p ON p.id=pa.payment_id WHERE NOT p.is_void GROUP BY pa.sale_id) a ON a.sale_id=s.id WHERE NOT s.is_void AND s.payment_type='credit';
GRANT SELECT ON public.v_invoice_balances TO authenticated;
CREATE OR REPLACE VIEW public.v_customer_summary WITH (security_invoker=true) AS
SELECT c.id,c.code,c.name,c.category,c.town,c.phone,c.contact_person,c.is_sample,coalesce(s.revenue,0) total_sales,coalesce(s.cost,0) total_cost,coalesce(s.revenue,0)-coalesce(s.cost,0) gross_profit,coalesce(s.n,0) invoice_count,s.last_date last_purchase_date,coalesce(b.balance,0) outstanding,coalesce(b.overdue,0) overdue,cl.credit_limit,cl.credit_days
FROM public.customers c
LEFT JOIN (SELECT customer_id,sum(total_amount) revenue,sum(total_cost) cost,count(*) n,max(sale_date) last_date FROM public.sales WHERE NOT is_void GROUP BY customer_id) s ON s.customer_id=c.id
LEFT JOIN (SELECT customer_id,sum(unpaid) balance,sum(CASE WHEN due_date<current_date THEN unpaid ELSE 0 END) overdue FROM public.v_invoice_balances GROUP BY customer_id) b ON b.customer_id=c.id
LEFT JOIN LATERAL (SELECT credit_limit,credit_days FROM public.credit_limits WHERE customer_id=c.id AND effective_from<=current_date ORDER BY effective_from DESC,created_at DESC LIMIT 1) cl ON true WHERE c.is_active;
CREATE OR REPLACE FUNCTION public.apply_import(_type text,_file text,_rows jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j uuid; r jsonb; c uuid; p uuid; s uuid; pay uuid; n numeric; existing public.sales%ROWTYPE; idx int:=0;
BEGIN
IF NOT public.is_finance(auth.uid()) THEN RAISE EXCEPTION 'Finance access required'; END IF;
IF _type NOT IN ('customers','sales','customer_payments','product_cost_history','customer_price_history','market_prices') OR jsonb_typeof(_rows)<>'array' OR jsonb_array_length(_rows)=0 OR jsonb_array_length(_rows)>2000 THEN RAISE EXCEPTION 'Invalid import or row count (1–2000)'; END IF;
PERFORM pg_advisory_xact_lock(771204);
INSERT INTO public.import_jobs(file_name,target_table,status,total_rows,valid_rows,created_by) VALUES(left(_file,255),_type,'completed',jsonb_array_length(_rows),jsonb_array_length(_rows),auth.uid()) RETURNING id INTO j;
FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
idx:=idx+1;
BEGIN
IF _type='customers' THEN
IF trim(coalesce(r->>'code',''))='' OR trim(coalesce(r->>'name',''))='' THEN RAISE EXCEPTION 'Customer code and name required'; END IF;
IF EXISTS(SELECT 1 FROM public.customers WHERE lower(code)=lower(r->>'code')) THEN RAISE EXCEPTION 'Duplicate customer code'; END IF;
INSERT INTO public.customers(code,name,contact_person,phone,town,category,created_by,import_job_id) VALUES(trim(r->>'code'),trim(r->>'name'),nullif(r->>'contact_person',''),nullif(r->>'phone',''),nullif(r->>'town',''),coalesce(nullif(r->>'category',''),'Retailer'),auth.uid(),j);
ELSE
IF r ? 'customer_code' THEN SELECT id INTO c FROM public.customers WHERE lower(code)=lower(r->>'customer_code') AND is_active AND NOT is_sample; IF c IS NULL THEN RAISE EXCEPTION 'Unknown real customer code'; END IF; END IF;
IF r ? 'sku' THEN SELECT id INTO p FROM public.products WHERE lower(sku)=lower(r->>'sku') AND NOT is_sample; IF p IS NULL THEN RAISE EXCEPTION 'Unknown real product SKU'; END IF; END IF;
IF _type='sales' THEN
IF coalesce(r->>'invoice_no','')='' OR r->>'payment_type' NOT IN ('credit','cash') OR (r->>'quantity_kg')::numeric<=0 OR (r->>'unit_price')::numeric<=0 OR (r->>'unit_cost')::numeric<=0 OR (r->>'due_date')::date<(r->>'sale_date')::date THEN RAISE EXCEPTION 'Invalid invoice, quantity, price, cost or due date'; END IF;
SELECT * INTO existing FROM public.sales WHERE lower(invoice_no)=lower(r->>'invoice_no');
IF existing.id IS NOT NULL AND existing.import_job_id IS DISTINCT FROM j THEN RAISE EXCEPTION 'Invoice already exists; no overwrite allowed'; END IF;
IF existing.id IS NOT NULL AND (existing.customer_id<>c OR existing.sale_date<>(r->>'sale_date')::date OR existing.due_date<>(r->>'due_date')::date OR existing.payment_type<>r->>'payment_type') THEN RAISE EXCEPTION 'Invoice rows have inconsistent dates/customer/payment type'; END IF;
IF existing.id IS NULL THEN INSERT INTO public.sales(invoice_no,customer_id,sale_date,due_date,payment_type,created_by,import_job_id) VALUES(r->>'invoice_no',c,(r->>'sale_date')::date,(r->>'due_date')::date,r->>'payment_type',auth.uid(),j) RETURNING id INTO s; ELSE s:=existing.id; END IF;
IF EXISTS(SELECT 1 FROM public.sale_items WHERE sale_id=s AND product_id=p) THEN RAISE EXCEPTION 'Duplicate invoice/product row'; END IF;
INSERT INTO public.sale_items(sale_id,product_id,quantity_kg,unit_price,unit_cost,line_total) VALUES(s,p,(r->>'quantity_kg')::numeric,(r->>'unit_price')::numeric,(r->>'unit_cost')::numeric,round((r->>'quantity_kg')::numeric*(r->>'unit_price')::numeric,2));
UPDATE public.sales SET total_amount=(SELECT sum(line_total) FROM public.sale_items WHERE sale_id=s),total_cost=(SELECT sum(round(quantity_kg*unit_cost,2)) FROM public.sale_items WHERE sale_id=s) WHERE id=s;
ELSIF _type='customer_payments' THEN
n:=(r->>'amount')::numeric;
SELECT id INTO s FROM public.sales WHERE lower(invoice_no)=lower(r->>'invoice_no') AND customer_id=c AND NOT is_void AND NOT is_sample AND payment_type='credit' AND sale_date<=(r->>'payment_date')::date FOR UPDATE;
IF s IS NULL OR n<=0 OR trim(coalesce(r->>'reference',''))='' THEN RAISE EXCEPTION 'Invalid credit invoice, reference or payment amount'; END IF;
IF EXISTS(SELECT 1 FROM public.customer_payments WHERE lower(reference)=lower(r->>'reference')) THEN RAISE EXCEPTION 'Duplicate payment reference'; END IF;
IF n>(SELECT total_amount FROM public.sales WHERE id=s)-coalesce((SELECT sum(a.amount) FROM public.payment_allocations a JOIN public.customer_payments cp ON cp.id=a.payment_id WHERE a.sale_id=s AND NOT cp.is_void),0) THEN RAISE EXCEPTION 'Payment exceeds unpaid invoice amount'; END IF;
INSERT INTO public.customer_payments(customer_id,payment_date,amount,method,reference,created_by,import_job_id) VALUES(c,(r->>'payment_date')::date,n,r->>'method',r->>'reference',auth.uid(),j) RETURNING id INTO pay;
INSERT INTO public.payment_allocations(payment_id,sale_id,amount,created_by) VALUES(pay,s,n,auth.uid());
ELSIF _type='product_cost_history' THEN
IF (r->>'landed_cost')::numeric<=0 THEN RAISE EXCEPTION 'Positive landed cost required'; END IF;
IF EXISTS(SELECT 1 FROM public.product_cost_history WHERE product_id=p AND effective_date=(r->>'effective_date')::date) THEN RAISE EXCEPTION 'Duplicate product cost/date'; END IF;
INSERT INTO public.product_cost_history(product_id,effective_date,landed_cost,source,created_by,import_job_id) VALUES(p,(r->>'effective_date')::date,(r->>'landed_cost')::numeric,r->>'source',auth.uid(),j);
ELSIF _type='customer_price_history' THEN
IF (r->>'price')::numeric<=0 THEN RAISE EXCEPTION 'Positive selling price required'; END IF;
IF EXISTS(SELECT 1 FROM public.customer_price_history WHERE customer_id=c AND product_id=p AND effective_date=(r->>'effective_date')::date) THEN RAISE EXCEPTION 'Duplicate customer price/date'; END IF;
INSERT INTO public.customer_price_history(customer_id,product_id,effective_date,price,created_by,import_job_id) VALUES(c,p,(r->>'effective_date')::date,(r->>'price')::numeric,auth.uid(),j);
ELSE
IF (r->>'price')::numeric<=0 OR r->>'source_type' NOT IN ('competitor','market') OR trim(coalesce(r->>'source_name',''))='' THEN RAISE EXCEPTION 'Positive quote, market/competitor type and source name required'; END IF;
IF EXISTS(SELECT 1 FROM public.market_prices WHERE product_id=p AND price_date=(r->>'price_date')::date AND lower(coalesce(source_name,''))=lower(r->>'source_name') AND source_type=r->>'source_type') THEN RAISE EXCEPTION 'Duplicate quotation'; END IF;
INSERT INTO public.market_prices(product_id,price_date,price,source_type,source_name,created_by,import_job_id) VALUES(p,(r->>'price_date')::date,(r->>'price')::numeric,r->>'source_type',r->>'source_name',auth.uid(),j);
END IF;
END IF;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Row %: %',idx,SQLERRM;
END;
END LOOP;
INSERT INTO public.audit_logs(table_name,record_id,action,changed_by,new_data) VALUES('import_jobs',j,'IMPORT',auth.uid(),jsonb_build_object('rows',idx,'type',_type));
RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.apply_import(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_import(text,text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.reverse_import(_job uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job public.import_jobs%ROWTYPE; t text;
BEGIN
IF NOT public.is_finance(auth.uid()) THEN RAISE EXCEPTION 'Finance access required'; END IF;
PERFORM pg_advisory_xact_lock(771204);
SELECT * INTO job FROM public.import_jobs WHERE id=_job FOR UPDATE;
IF job.id IS NULL OR job.status<>'completed' THEN RAISE EXCEPTION 'Only completed imports can be reversed once'; END IF;
IF EXISTS(SELECT 1 FROM public.audit_logs WHERE table_name IN ('customers','sales','customer_payments','product_cost_history','customer_price_history','market_prices') AND action='UPDATE' AND old_data->>'import_job_id'=_job::text AND created_at>job.created_at) THEN RAISE EXCEPTION 'Imported records were edited; reversal requires review'; END IF;
IF job.target_table='customers' THEN
IF EXISTS(SELECT 1 FROM public.customers c WHERE c.import_job_id=_job AND (EXISTS(SELECT 1 FROM public.sales s WHERE s.customer_id=c.id) OR EXISTS(SELECT 1 FROM public.customer_payments p WHERE p.customer_id=c.id) OR EXISTS(SELECT 1 FROM public.customer_price_history h WHERE h.customer_id=c.id) OR EXISTS(SELECT 1 FROM public.credit_limits l WHERE l.customer_id=c.id) OR EXISTS(SELECT 1 FROM public.customer_ledger_entries e WHERE e.customer_id=c.id))) THEN RAISE EXCEPTION 'Customers have dependent records; reverse dependent imports first'; END IF;
UPDATE public.customers SET is_active=false WHERE import_job_id=_job;
ELSIF job.target_table='sales' THEN
IF EXISTS(SELECT 1 FROM public.payment_allocations a JOIN public.sales s ON s.id=a.sale_id JOIN public.customer_payments p ON p.id=a.payment_id WHERE s.import_job_id=_job AND NOT p.is_void) THEN RAISE EXCEPTION 'Invoices have allocated payments; reverse payments first'; END IF;
UPDATE public.sales SET is_void=true WHERE import_job_id=_job;
ELSE
IF job.target_table NOT IN ('customer_payments','product_cost_history','customer_price_history','market_prices') THEN RAISE EXCEPTION 'This import cannot be safely reversed'; END IF;
EXECUTE format('UPDATE public.%I SET is_void=true WHERE import_job_id=$1',job.target_table) USING _job;
END IF;
UPDATE public.import_jobs SET status='reversed',reversed_at=now(),reversed_by=auth.uid() WHERE id=_job;
INSERT INTO public.audit_logs(table_name,record_id,action,changed_by) VALUES('import_jobs',_job,'REVERSE',auth.uid());
RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.reverse_import(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reverse_import(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.set_team_role(_user uuid,_role public.app_role) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
IF NOT public.has_role(auth.uid(),'owner') THEN RAISE EXCEPTION 'Owner access required'; END IF;
PERFORM pg_advisory_xact_lock(771205);
IF public.has_role(_user,'owner') AND _role<>'owner' AND (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role='owner')<=1 THEN RAISE EXCEPTION 'Cannot remove the last owner'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=_user) THEN RAISE EXCEPTION 'Unknown team member'; END IF;
DELETE FROM public.user_roles WHERE user_id=_user;
INSERT INTO public.user_roles(user_id,role) VALUES(_user,_role);
INSERT INTO public.audit_logs(table_name,record_id,action,changed_by,new_data) VALUES('user_roles',_user,'ROLE_CHANGE',auth.uid(),jsonb_build_object('role',_role));
RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.set_team_role(uuid,public.app_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_team_role(uuid,public.app_role) TO authenticated;