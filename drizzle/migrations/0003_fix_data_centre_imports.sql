-- Migration 0003: Fix Excel Data Centre imports for all 7 record types and ensure transactional provenance

-- 1. Ensure import_jobs allows proper tracking and querying
GRANT SELECT, INSERT, UPDATE ON public.import_jobs TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.products TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.inventory_snapshots TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.sales TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.sale_items TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.customer_payments TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.product_cost_history TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.market_prices TO authenticated, anon;

-- 2. Create comprehensive, transactional apply_import function supporting all 7 record types
CREATE OR REPLACE FUNCTION public.apply_import(_type text, _file text, _rows jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  j uuid;
  r jsonb;
  c uuid;
  p uuid;
  s uuid;
  pay uuid;
  n numeric;
  existing public.sales%ROWTYPE;
  idx int := 0;
  applied_count int := 0;
  acting_user uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid);
  cust_code text;
  cust_name text;
  prod_sku text;
  prod_name text;
BEGIN
  -- Validate permission if authenticated
  IF auth.uid() IS NOT NULL AND NOT public.is_finance(auth.uid()) THEN
    RAISE EXCEPTION 'Finance access required';
  END IF;

  IF _type NOT IN ('customers','products','sales','customer_payments','product_cost_history','inventory_snapshots','market_prices')
     OR jsonb_typeof(_rows) <> 'array'
     OR jsonb_array_length(_rows) = 0
     OR jsonb_array_length(_rows) > 2000 THEN
    RAISE EXCEPTION 'Invalid import type or row count (1–2000)';
  END IF;

  PERFORM pg_advisory_xact_lock(771204);

  INSERT INTO public.import_jobs (
    file_name, target_table, status, total_rows, valid_rows, created_by
  ) VALUES (
    left(_file, 255), _type, 'completed', jsonb_array_length(_rows), 0, acting_user
  ) RETURNING id INTO j;

  FOR r IN SELECT value FROM jsonb_array_elements(_rows) LOOP
    idx := idx + 1;
    BEGIN
      -- ==================== 1. CUSTOMERS ====================
      IF _type = 'customers' THEN
        cust_code := trim(coalesce(r->>'code', ''));
        cust_name := trim(coalesce(r->>'name', ''));
        IF cust_code = '' OR cust_name = '' THEN
          RAISE EXCEPTION 'Customer code and name are required';
        END IF;

        IF EXISTS (SELECT 1 FROM public.customers WHERE lower(code) = lower(cust_code) AND is_active) THEN
          RAISE EXCEPTION 'Customer code "%" already exists', cust_code;
        END IF;

        INSERT INTO public.customers (
          code, name, contact_person, phone, town, category,
          is_active, is_sample, created_by, import_job_id
        ) VALUES (
          cust_code, cust_name,
          nullif(trim(r->>'contact_person'), ''),
          nullif(trim(r->>'phone'), ''),
          nullif(trim(r->>'town'), ''),
          coalesce(nullif(trim(r->>'category'), ''), 'Retailer'),
          true, false, acting_user, j
        );
        applied_count := applied_count + 1;

      -- ==================== 2. PRODUCTS ====================
      ELSIF _type = 'products' THEN
        prod_sku := trim(coalesce(r->>'sku', ''));
        prod_name := trim(coalesce(r->>'name', ''));
        IF prod_sku = '' OR prod_name = '' THEN
          RAISE EXCEPTION 'Product SKU and name are required';
        END IF;

        IF EXISTS (SELECT 1 FROM public.products WHERE lower(sku) = lower(prod_sku) AND is_active) THEN
          RAISE EXCEPTION 'Product SKU "%" already exists', prod_sku;
        END IF;

        INSERT INTO public.products (
          sku, name, category, unit, pack_size_kg,
          is_sample, is_active, created_by, import_job_id
        ) VALUES (
          prod_sku, prod_name,
          coalesce(nullif(trim(r->>'category'), ''), 'General'),
          coalesce(nullif(trim(r->>'unit'), ''), 'kg'),
          nullif(trim(r->>'pack_size_kg'), '')::numeric,
          false, true, acting_user, j
        );
        applied_count := applied_count + 1;

      -- ==================== 3. SALES ====================
      ELSIF _type = 'sales' THEN
        SELECT id INTO c FROM public.customers WHERE lower(code) = lower(trim(r->>'customer_code')) AND is_active LIMIT 1;
        IF c IS NULL THEN
          RAISE EXCEPTION 'Unknown customer code "%"', r->>'customer_code';
        END IF;

        SELECT id INTO p FROM public.products WHERE lower(sku) = lower(trim(r->>'sku')) AND is_active LIMIT 1;
        IF p IS NULL THEN
          RAISE EXCEPTION 'Unknown product SKU "%"', r->>'sku';
        END IF;

        IF coalesce(r->>'invoice_no','') = ''
           OR r->>'payment_type' NOT IN ('credit','cash')
           OR (r->>'quantity_kg')::numeric <= 0
           OR (r->>'unit_price')::numeric <= 0
           OR (r->>'unit_cost')::numeric <= 0
           OR (r->>'due_date')::date < (r->>'sale_date')::date THEN
          RAISE EXCEPTION 'Invalid invoice details, pricing or due date';
        END IF;

        SELECT * INTO existing FROM public.sales WHERE lower(invoice_no) = lower(trim(r->>'invoice_no'));
        IF existing.id IS NOT NULL AND existing.import_job_id IS DISTINCT FROM j THEN
          RAISE EXCEPTION 'Invoice "%" already exists', r->>'invoice_no';
        END IF;

        IF existing.id IS NULL THEN
          INSERT INTO public.sales (
            invoice_no, customer_id, sale_date, due_date, payment_type,
            is_sample, is_void, created_by, import_job_id
          ) VALUES (
            trim(r->>'invoice_no'), c, (r->>'sale_date')::date, (r->>'due_date')::date, r->>'payment_type',
            false, false, acting_user, j
          ) RETURNING id INTO s;
        ELSE
          s := existing.id;
        END IF;

        IF EXISTS (SELECT 1 FROM public.sale_items WHERE sale_id = s AND product_id = p) THEN
          RAISE EXCEPTION 'Duplicate SKU "%" on invoice "%"', r->>'sku', r->>'invoice_no';
        END IF;

        INSERT INTO public.sale_items (
          sale_id, product_id, quantity_kg, unit_price, unit_cost, line_total
        ) VALUES (
          s, p, (r->>'quantity_kg')::numeric, (r->>'unit_price')::numeric, (r->>'unit_cost')::numeric,
          round((r->>'quantity_kg')::numeric * (r->>'unit_price')::numeric, 2)
        );

        UPDATE public.sales
        SET total_amount = (SELECT coalesce(sum(line_total), 0) FROM public.sale_items WHERE sale_id = s),
            total_cost = (SELECT coalesce(sum(round(quantity_kg * unit_cost, 2)), 0) FROM public.sale_items WHERE sale_id = s)
        WHERE id = s;
        applied_count := applied_count + 1;

      -- ==================== 4. CUSTOMER PAYMENTS ====================
      ELSIF _type = 'customer_payments' THEN
        SELECT id INTO c FROM public.customers WHERE lower(code) = lower(trim(r->>'customer_code')) AND is_active LIMIT 1;
        IF c IS NULL THEN
          RAISE EXCEPTION 'Unknown customer code "%"', r->>'customer_code';
        END IF;

        n := (r->>'amount')::numeric;
        IF n <= 0 OR trim(coalesce(r->>'reference','')) = '' THEN
          RAISE EXCEPTION 'Valid positive amount and payment reference required';
        END IF;

        IF EXISTS (SELECT 1 FROM public.customer_payments WHERE lower(reference) = lower(trim(r->>'reference')) AND NOT is_void) THEN
          RAISE EXCEPTION 'Payment reference "%" already exists', r->>'reference';
        END IF;

        -- If linked to credit invoice, validate and allocate
        IF nullif(trim(r->>'invoice_no'), '') IS NOT NULL THEN
          SELECT id INTO s FROM public.sales
          WHERE lower(invoice_no) = lower(trim(r->>'invoice_no'))
            AND customer_id = c AND NOT is_void AND payment_type = 'credit'
          FOR UPDATE;

          IF s IS NULL THEN
            RAISE EXCEPTION 'Credit invoice "%" not found for customer', r->>'invoice_no';
          END IF;

          INSERT INTO public.customer_payments (
            customer_id, payment_date, amount, method, reference,
            is_sample, is_void, created_by, import_job_id
          ) VALUES (
            c, (r->>'payment_date')::date, n, nullif(trim(r->>'method'), ''), trim(r->>'reference'),
            false, false, acting_user, j
          ) RETURNING id INTO pay;

          INSERT INTO public.payment_allocations (payment_id, sale_id, amount, created_by)
          VALUES (pay, s, n, acting_user);
        ELSE
          INSERT INTO public.customer_payments (
            customer_id, payment_date, amount, method, reference,
            is_sample, is_void, created_by, import_job_id
          ) VALUES (
            c, (r->>'payment_date')::date, n, nullif(trim(r->>'method'), ''), trim(r->>'reference'),
            false, false, acting_user, j
          );
        END IF;
        applied_count := applied_count + 1;

      -- ==================== 5. LANDED COSTS ====================
      ELSIF _type = 'product_cost_history' THEN
        SELECT id INTO p FROM public.products WHERE lower(sku) = lower(trim(r->>'sku')) AND is_active LIMIT 1;
        IF p IS NULL THEN
          RAISE EXCEPTION 'Unknown product SKU "%"', r->>'sku';
        END IF;

        IF (r->>'landed_cost')::numeric <= 0 THEN
          RAISE EXCEPTION 'Positive landed cost required';
        END IF;

        IF EXISTS (SELECT 1 FROM public.product_cost_history WHERE product_id = p AND effective_date = (r->>'effective_date')::date AND NOT is_void) THEN
          RAISE EXCEPTION 'Landed cost already exists for SKU "%" on date "%"', r->>'sku', r->>'effective_date';
        END IF;

        INSERT INTO public.product_cost_history (
          product_id, effective_date, landed_cost, source,
          is_void, created_by, import_job_id
        ) VALUES (
          p, (r->>'effective_date')::date, (r->>'landed_cost')::numeric, nullif(trim(r->>'source'), ''),
          false, acting_user, j
        );
        applied_count := applied_count + 1;

      -- ==================== 6. INVENTORY ====================
      ELSIF _type = 'inventory_snapshots' THEN
        SELECT id INTO p FROM public.products WHERE lower(sku) = lower(trim(r->>'sku')) AND is_active LIMIT 1;
        IF p IS NULL THEN
          RAISE EXCEPTION 'Unknown product SKU "%"', r->>'sku';
        END IF;

        IF trim(coalesce(r->>'godown', '')) = ''
           OR (r->>'quantity_kg')::numeric < 0
           OR (r->>'avg_cost')::numeric < 0
           OR nullif(r->>'snapshot_date', '') IS NULL THEN
          RAISE EXCEPTION 'Valid godown, snapshot date, quantity and cost required';
        END IF;

        IF EXISTS (SELECT 1 FROM public.inventory_snapshots WHERE product_id = p AND lower(godown) = lower(trim(r->>'godown')) AND snapshot_date = (r->>'snapshot_date')::date AND NOT is_void) THEN
          RAISE EXCEPTION 'Snapshot already exists for SKU "%" in godown "%" on "%"', r->>'sku', r->>'godown', r->>'snapshot_date';
        END IF;

        INSERT INTO public.inventory_snapshots (
          product_id, godown, snapshot_date, quantity_kg, avg_cost,
          is_void, created_by, import_job_id
        ) VALUES (
          p, trim(r->>'godown'), (r->>'snapshot_date')::date, (r->>'quantity_kg')::numeric, (r->>'avg_cost')::numeric,
          false, acting_user, j
        );
        applied_count := applied_count + 1;

      -- ==================== 7. COMPETITOR / MARKET PRICES ====================
      ELSE
        SELECT id INTO p FROM public.products WHERE lower(sku) = lower(trim(r->>'sku')) AND is_active LIMIT 1;
        IF p IS NULL THEN
          RAISE EXCEPTION 'Unknown product SKU "%"', r->>'sku';
        END IF;

        IF (r->>'price')::numeric <= 0
           OR r->>'source_type' NOT IN ('competitor', 'market')
           OR trim(coalesce(r->>'source_name', '')) = '' THEN
          RAISE EXCEPTION 'Valid positive price, source type (market/competitor) and source name required';
        END IF;

        IF EXISTS (
          SELECT 1 FROM public.market_prices
          WHERE product_id = p
            AND price_date = (r->>'price_date')::date
            AND lower(coalesce(source_name, '')) = lower(trim(r->>'source_name'))
            AND source_type = r->>'source_type'
            AND NOT is_void
        ) THEN
          RAISE EXCEPTION 'Quotation already exists for SKU "%" on date "%"', r->>'sku', r->>'price_date';
        END IF;

        INSERT INTO public.market_prices (
          product_id, price_date, price, source_type, source_name,
          is_void, created_by, import_job_id
        ) VALUES (
          p, (r->>'price_date')::date, (r->>'price')::numeric, r->>'source_type', trim(r->>'source_name'),
          false, acting_user, j
        );
        applied_count := applied_count + 1;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Row %: %', idx, SQLERRM;
    END;
  END LOOP;

  UPDATE public.import_jobs
  SET valid_rows = applied_count
  WHERE id = j;

  INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, new_data)
  VALUES ('import_jobs', j, 'IMPORT', acting_user, jsonb_build_object('type', _type, 'rows', applied_count));

  RETURN j;
END $$;

-- 3. Grants for apply_import
REVOKE ALL ON FUNCTION public.apply_import(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_import(text, text, jsonb) TO authenticated, anon;

-- 4. Create comprehensive reverse_import function for all 7 record types
CREATE OR REPLACE FUNCTION public.reverse_import(_job uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  job public.import_jobs%ROWTYPE;
  acting_user uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid);
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_finance(auth.uid()) THEN
    RAISE EXCEPTION 'Finance access required';
  END IF;

  PERFORM pg_advisory_xact_lock(771204);

  SELECT * INTO job FROM public.import_jobs WHERE id = _job FOR UPDATE;
  IF job.id IS NULL OR job.status <> 'completed' THEN
    RAISE EXCEPTION 'Only completed import jobs can be reversed';
  END IF;

  -- 1. Customers reversal
  IF job.target_table = 'customers' THEN
    IF EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.import_job_id = _job
        AND (
          EXISTS (SELECT 1 FROM public.sales s WHERE s.customer_id = c.id AND NOT s.is_void)
          OR EXISTS (SELECT 1 FROM public.customer_payments p WHERE p.customer_id = c.id AND NOT p.is_void)
        )
    ) THEN
      RAISE EXCEPTION 'Imported customers have active sales or payments. Reverse dependent records first.';
    END IF;
    UPDATE public.customers SET is_active = false WHERE import_job_id = _job;

  -- 2. Products reversal
  ELSIF job.target_table = 'products' THEN
    IF EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.import_job_id = _job
        AND (
          EXISTS (SELECT 1 FROM public.sale_items s WHERE s.product_id = p.id)
          OR EXISTS (SELECT 1 FROM public.inventory_snapshots i WHERE i.product_id = p.id AND NOT i.is_void)
        )
    ) THEN
      RAISE EXCEPTION 'Imported products have active sales or inventory. Reverse dependent records first.';
    END IF;
    UPDATE public.products SET is_active = false WHERE import_job_id = _job;

  -- 3. Sales reversal
  ELSIF job.target_table = 'sales' THEN
    IF EXISTS (
      SELECT 1 FROM public.payment_allocations a
      JOIN public.sales s ON s.id = a.sale_id
      JOIN public.customer_payments p ON p.id = a.payment_id
      WHERE s.import_job_id = _job AND NOT p.is_void
    ) THEN
      RAISE EXCEPTION 'Invoices have allocated payments. Reverse payments first.';
    END IF;
    UPDATE public.sales SET is_void = true WHERE import_job_id = _job;

  -- 4. Customer payments reversal
  ELSIF job.target_table = 'customer_payments' THEN
    DELETE FROM public.payment_allocations
    WHERE payment_id IN (SELECT id FROM public.customer_payments WHERE import_job_id = _job);
    UPDATE public.customer_payments SET is_void = true WHERE import_job_id = _job;

  -- 5. Landed costs reversal
  ELSIF job.target_table = 'product_cost_history' THEN
    UPDATE public.product_cost_history SET is_void = true WHERE import_job_id = _job;

  -- 6. Inventory reversal
  ELSIF job.target_table = 'inventory_snapshots' THEN
    UPDATE public.inventory_snapshots SET is_void = true WHERE import_job_id = _job;

  -- 7. Competitor prices reversal
  ELSIF job.target_table = 'market_prices' THEN
    UPDATE public.market_prices SET is_void = true WHERE import_job_id = _job;
  ELSE
    RAISE EXCEPTION 'Unrecognized import target table "%"', job.target_table;
  END IF;

  UPDATE public.import_jobs
  SET status = 'reversed', reversed_at = now(), reversed_by = acting_user
  WHERE id = _job;

  INSERT INTO public.audit_logs (table_name, record_id, action, changed_by)
  VALUES ('import_jobs', _job, 'REVERSE', acting_user);

  RETURN true;
END $$;

REVOKE ALL ON FUNCTION public.reverse_import(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_import(uuid) TO authenticated, anon;
