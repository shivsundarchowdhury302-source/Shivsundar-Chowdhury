ALTER TABLE public.products ADD COLUMN import_job_id uuid REFERENCES public.import_jobs(id), ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.inventory_snapshots ADD COLUMN import_job_id uuid REFERENCES public.import_jobs(id), ADD COLUMN is_void boolean NOT NULL DEFAULT false;
DO $$ DECLARE definition text; BEGIN SELECT pg_get_functiondef('public.apply_import(text,text,jsonb)'::regprocedure) INTO definition; EXECUTE replace(definition,'FUNCTION public.apply_import(', 'FUNCTION public.apply_import_financial('); SELECT pg_get_functiondef('public.reverse_import(uuid)'::regprocedure) INTO definition; EXECUTE replace(definition,'FUNCTION public.reverse_import(', 'FUNCTION public.reverse_import_financial('); END $$;
REVOKE ALL ON FUNCTION public.apply_import_financial(text,text,jsonb),public.reverse_import_financial(uuid) FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.apply_import(_type text,_file text,_rows jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE j uuid;r jsonb;p uuid;c uuid;n numeric;idx int:=0;
BEGIN
IF NOT public.is_finance(auth.uid()) THEN RAISE EXCEPTION 'Finance access required'; END IF;
IF jsonb_typeof(_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Rows must be an array'; END IF;
IF jsonb_array_length(_rows)<1 OR jsonb_array_length(_rows)>2000 THEN RAISE EXCEPTION 'Import requires 1–2000 rows'; END IF;
IF _type NOT IN ('products','inventory_snapshots','customer_payments') THEN RETURN public.apply_import_financial(_type,_file,_rows); END IF;
PERFORM pg_advisory_xact_lock(771204);
INSERT INTO public.import_jobs(file_name,target_table,status,total_rows,valid_rows,created_by) VALUES(left(_file,255),_type,'completed',jsonb_array_length(_rows),jsonb_array_length(_rows),auth.uid()) RETURNING id INTO j;
FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
idx:=idx+1;
BEGIN
IF _type='products' THEN
IF trim(coalesce(r->>'sku',''))='' OR trim(coalesce(r->>'name',''))='' THEN RAISE EXCEPTION 'SKU and product name required'; END IF;
IF EXISTS(SELECT 1 FROM public.products WHERE lower(sku)=lower(trim(r->>'sku'))) THEN RAISE EXCEPTION 'SKU already exists; no overwrite allowed'; END IF;
INSERT INTO public.products(sku,name,category,unit,pack_size_kg,import_job_id,created_by) VALUES(trim(r->>'sku'),trim(r->>'name'),nullif(r->>'category',''),coalesce(nullif(r->>'unit',''),'kg'),nullif(r->>'pack_size_kg','')::numeric,j,auth.uid());
ELSIF _type='inventory_snapshots' THEN
SELECT id INTO p FROM public.products WHERE lower(sku)=lower(r->>'sku') AND NOT is_sample AND is_active;
IF p IS NULL OR trim(coalesce(r->>'godown',''))='' OR coalesce((r->>'quantity_kg')::numeric,-1)<0 OR coalesce((r->>'avg_cost')::numeric,-1)<0 OR nullif(r->>'snapshot_date','') IS NULL THEN RAISE EXCEPTION 'Invalid product, location, date, stock or acquisition cost'; END IF;
IF EXISTS(SELECT 1 FROM public.inventory_snapshots WHERE product_id=p AND godown=r->>'godown' AND snapshot_date=(r->>'snapshot_date')::date AND NOT is_void) THEN RAISE EXCEPTION 'Snapshot already exists'; END IF;
INSERT INTO public.inventory_snapshots(product_id,godown,snapshot_date,quantity_kg,avg_cost,import_job_id,created_by) VALUES(p,r->>'godown',(r->>'snapshot_date')::date,(r->>'quantity_kg')::numeric,(r->>'avg_cost')::numeric,j,auth.uid());
ELSE
IF nullif(trim(r->>'invoice_no'),'') IS NOT NULL THEN
RAISE EXCEPTION 'Use the allocated payment import for invoice-linked payments';
END IF;
SELECT id INTO c FROM public.customers WHERE lower(code)=lower(r->>'customer_code') AND NOT is_sample AND is_active;
n:=(r->>'amount')::numeric;
IF c IS NULL OR coalesce(n,0)<=0 OR trim(coalesce(r->>'reference',''))='' OR nullif(r->>'payment_date','') IS NULL THEN RAISE EXCEPTION 'Valid customer, date, positive amount and reference required'; END IF;
IF EXISTS(SELECT 1 FROM public.customer_payments WHERE lower(reference)=lower(r->>'reference')) THEN RAISE EXCEPTION 'Payment reference already exists'; END IF;
INSERT INTO public.customer_payments(customer_id,payment_date,amount,method,reference,import_job_id,created_by) VALUES(c,(r->>'payment_date')::date,n,r->>'method',r->>'reference',j,auth.uid());
END IF;
EXCEPTION WHEN OTHERS THEN RAISE EXCEPTION 'Row %: %',idx,SQLERRM;
END;
END LOOP;
INSERT INTO public.audit_logs(table_name,record_id,action,changed_by,new_data) VALUES('import_jobs',j,'IMPORT',auth.uid(),jsonb_build_object('type',_type,'rows',idx));
RETURN j;
END $$;
CREATE OR REPLACE FUNCTION public.apply_allocated_payment_import(_file text,_rows jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NOT public.is_finance(auth.uid()) THEN RAISE EXCEPTION 'Finance access required'; END IF; RETURN public.apply_import_financial('customer_payments',_file,_rows); END $$;
REVOKE ALL ON FUNCTION public.apply_allocated_payment_import(text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.apply_allocated_payment_import(text,jsonb) TO authenticated;
CREATE OR REPLACE FUNCTION public.reverse_import(_job uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE job public.import_jobs%ROWTYPE;
BEGIN
IF NOT public.is_finance(auth.uid()) THEN RAISE EXCEPTION 'Finance access required'; END IF;
PERFORM pg_advisory_xact_lock(771204);
SELECT * INTO job FROM public.import_jobs WHERE id=_job FOR UPDATE;
IF job.target_table NOT IN ('products','inventory_snapshots') THEN RETURN public.reverse_import_financial(_job); END IF;
IF job.id IS NULL OR job.status<>'completed' THEN RAISE EXCEPTION 'Only completed imports can be reversed'; END IF;
IF EXISTS(SELECT 1 FROM public.audit_logs WHERE old_data->>'import_job_id'=_job::text AND action='UPDATE' AND created_at>job.created_at) THEN RAISE EXCEPTION 'Imported records were edited; review required'; END IF;
IF job.target_table='products' THEN
IF EXISTS(SELECT 1 FROM public.products p WHERE p.import_job_id=_job AND (EXISTS(SELECT 1 FROM public.sale_items s WHERE s.product_id=p.id) OR EXISTS(SELECT 1 FROM public.inventory_snapshots i WHERE i.product_id=p.id) OR EXISTS(SELECT 1 FROM public.product_cost_history h WHERE h.product_id=p.id) OR EXISTS(SELECT 1 FROM public.customer_price_history h WHERE h.product_id=p.id) OR EXISTS(SELECT 1 FROM public.market_prices h WHERE h.product_id=p.id) OR EXISTS(SELECT 1 FROM public.purchases h WHERE h.product_id=p.id))) THEN RAISE EXCEPTION 'Products have dependent records; review required'; END IF;
UPDATE public.products SET is_active=false WHERE import_job_id=_job;
ELSE UPDATE public.inventory_snapshots SET is_void=true WHERE import_job_id=_job; END IF;
UPDATE public.import_jobs SET status='reversed',reversed_at=now(),reversed_by=auth.uid() WHERE id=_job;
INSERT INTO public.audit_logs(table_name,record_id,action,changed_by) VALUES('import_jobs',_job,'REVERSE',auth.uid()); RETURN true;
END $$;
CREATE OR REPLACE FUNCTION public.save_customer(_id uuid,_values jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c uuid;
BEGIN
IF NOT public.is_finance(auth.uid()) THEN RAISE EXCEPTION 'Finance access required'; END IF;
IF trim(coalesce(_values->>'name',''))='' OR coalesce((_values->>'credit_limit')::numeric,-1)<0 OR coalesce((_values->>'credit_days')::int,-1)<0 THEN RAISE EXCEPTION 'Name and nonnegative credit limit and days required'; END IF;
IF _id IS NULL THEN INSERT INTO public.customers(code,name,contact_person,phone,town,category,created_by) VALUES(nullif(trim(_values->>'code'),''),trim(_values->>'name'),_values->>'contact_person',_values->>'phone',_values->>'town',_values->>'category',auth.uid()) RETURNING id INTO c;
ELSE UPDATE public.customers SET name=trim(_values->>'name'),contact_person=_values->>'contact_person',phone=_values->>'phone',town=_values->>'town',category=_values->>'category' WHERE id=_id AND is_active AND NOT is_sample RETURNING id INTO c; IF c IS NULL THEN RAISE EXCEPTION 'Active real customer required'; END IF; END IF;
INSERT INTO public.credit_limits(customer_id,credit_limit,credit_days,effective_from,created_by) VALUES(c,(_values->>'credit_limit')::numeric,(_values->>'credit_days')::int,current_date,auth.uid()); RETURN c;
END $$;
REVOKE ALL ON FUNCTION public.save_customer(uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_customer(uuid,jsonb) TO authenticated;