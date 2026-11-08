-- Migration 0005: Bulletproof Multi-Tenant RLS Policies and Tenant Scoping
-- Replaces legacy global role policies with business-membership-based RLS
-- Enforces Owner, Admin, Staff, and Viewer RBAC per business_id

-- 1. Ensure all business-owned operational entities have business_id column
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.credit_limits ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.customer_ledger_entries ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.sale_items ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.payment_allocations ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);

-- Backfill business_id from parents or default enterprise workspace
UPDATE public.suppliers SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;
UPDATE public.purchases SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;
UPDATE public.expenses SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;

UPDATE public.credit_limits cl
SET business_id = c.business_id
FROM public.customers c
WHERE cl.customer_id = c.id AND cl.business_id IS NULL;
UPDATE public.credit_limits SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;

UPDATE public.customer_ledger_entries cle
SET business_id = c.business_id
FROM public.customers c
WHERE cle.customer_id = c.id AND cle.business_id IS NULL;
UPDATE public.customer_ledger_entries SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;

UPDATE public.sale_items si
SET business_id = s.business_id
FROM public.sales s
WHERE si.sale_id = s.id AND si.business_id IS NULL;
UPDATE public.sale_items SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;

UPDATE public.payment_allocations pa
SET business_id = s.business_id
FROM public.sales s
WHERE pa.sale_id = s.id AND pa.business_id IS NULL;
UPDATE public.payment_allocations SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;

-- 2. Helper functions for business membership and role validation
CREATE OR REPLACE FUNCTION public.is_business_member(_business_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_memberships
    WHERE business_id = _business_id
      AND user_id = coalesce(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.has_business_role(_business_id uuid, _roles text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.business_memberships
    WHERE business_id = _business_id
      AND user_id = coalesce(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid)
      AND status = 'active'
      AND role = ANY(_roles)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_business_member(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_business_role(uuid, text[]) TO authenticated, anon;

-- 3. Drop legacy global-role policies
DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    IF pol IN (
      'team read', 'finance insert', 'finance update', 'finance read',
      'owner read', 'finance reads allocations'
    ) THEN
      FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
        BEGIN
          EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
        EXCEPTION WHEN OTHERS THEN NULL;
        END;
      END LOOP;
    END IF;
  END LOOP;
END $$;

-- 4. Enable RLS on all tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'businesses', 'business_memberships', 'invitations',
    'customers', 'products', 'suppliers', 'sales', 'sale_items',
    'customer_payments', 'payment_allocations', 'customer_ledger_entries',
    'credit_limits', 'purchases', 'expenses', 'product_cost_history',
    'customer_price_history', 'market_prices', 'inventory_snapshots',
    'import_jobs', 'audit_logs'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 5. Multi-tenant RLS policies for businesses, memberships, invitations
DROP POLICY IF EXISTS "tenant_members_select_business" ON public.businesses;
CREATE POLICY "tenant_members_select_business" ON public.businesses
FOR SELECT TO authenticated, anon
USING (public.is_business_member(id) OR created_by = auth.uid());

DROP POLICY IF EXISTS "authenticated_insert_business" ON public.businesses;
CREATE POLICY "authenticated_insert_business" ON public.businesses
FOR INSERT TO authenticated, anon
WITH CHECK (true);

DROP POLICY IF EXISTS "tenant_owner_admin_update_business" ON public.businesses;
CREATE POLICY "tenant_owner_admin_update_business" ON public.businesses
FOR UPDATE TO authenticated, anon
USING (public.has_business_role(id, ARRAY['owner', 'admin']))
WITH CHECK (public.has_business_role(id, ARRAY['owner', 'admin']));

-- Business memberships
DROP POLICY IF EXISTS "members_select_memberships" ON public.business_memberships;
CREATE POLICY "members_select_memberships" ON public.business_memberships
FOR SELECT TO authenticated, anon
USING (public.is_business_member(business_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "owner_admin_manage_memberships" ON public.business_memberships;
CREATE POLICY "owner_admin_manage_memberships" ON public.business_memberships
FOR ALL TO authenticated, anon
USING (public.has_business_role(business_id, ARRAY['owner', 'admin']))
WITH CHECK (public.has_business_role(business_id, ARRAY['owner', 'admin']));

-- Invitations
DROP POLICY IF EXISTS "members_select_invitations" ON public.invitations;
CREATE POLICY "members_select_invitations" ON public.invitations
FOR SELECT TO authenticated, anon
USING (public.is_business_member(business_id));

DROP POLICY IF EXISTS "owner_admin_manage_invitations" ON public.invitations;
CREATE POLICY "owner_admin_manage_invitations" ON public.invitations
FOR ALL TO authenticated, anon
USING (public.has_business_role(business_id, ARRAY['owner', 'admin']))
WITH CHECK (public.has_business_role(business_id, ARRAY['owner', 'admin']));

-- 6. Generic Multi-Tenant RLS for operational tables
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customers', 'products', 'suppliers', 'sales', 'sale_items',
    'customer_payments', 'payment_allocations', 'customer_ledger_entries',
    'credit_limits', 'purchases', 'expenses', 'product_cost_history',
    'customer_price_history', 'market_prices', 'inventory_snapshots',
    'import_jobs', 'audit_logs'
  ] LOOP
    -- SELECT: Any active member (owner, admin, staff, viewer) can view records
    EXECUTE format('DROP POLICY IF EXISTS "tenant_member_read_%s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "tenant_member_read_%s" ON public.%I FOR SELECT TO authenticated, anon USING (public.is_business_member(business_id))', t, t);

    -- INSERT: Owner, Admin, Staff (Viewers cannot insert)
    EXECUTE format('DROP POLICY IF EXISTS "tenant_staff_insert_%s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "tenant_staff_insert_%s" ON public.%I FOR INSERT TO authenticated, anon WITH CHECK (business_id IS NOT NULL AND public.has_business_role(business_id, ARRAY[''owner'', ''admin'', ''staff'']))', t, t);

    -- UPDATE: Owner, Admin, Staff (Viewers cannot update)
    EXECUTE format('DROP POLICY IF EXISTS "tenant_staff_update_%s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "tenant_staff_update_%s" ON public.%I FOR UPDATE TO authenticated, anon USING (public.has_business_role(business_id, ARRAY[''owner'', ''admin'', ''staff''])) WITH CHECK (public.has_business_role(business_id, ARRAY[''owner'', ''admin'', ''staff'']))', t, t);

    -- DELETE: Restricted to Owner / Admin only
    EXECUTE format('DROP POLICY IF EXISTS "tenant_owner_delete_%s" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "tenant_owner_delete_%s" ON public.%I FOR DELETE TO authenticated, anon USING (public.has_business_role(business_id, ARRAY[''owner'', ''admin'']))', t, t);
  END LOOP;
END $$;
