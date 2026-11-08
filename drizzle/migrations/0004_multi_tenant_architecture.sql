-- Migration 0004: Multi-Tenant Architecture & Isolation
-- Tables: businesses, business_memberships, invitations
-- Tenant scoping: business_id on all operational entities

-- 1. Create businesses table
CREATE TABLE IF NOT EXISTS public.businesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_by uuid,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create business_memberships table
CREATE TABLE IF NOT EXISTS public.business_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deactivated')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

-- 3. Create invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner', 'admin', 'staff', 'viewer')),
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
  invited_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Add business_id to business-owned entities
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.customer_payments ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.inventory_snapshots ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.product_cost_history ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.market_prices ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.customer_price_history ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.import_jobs ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES public.businesses(id);

-- 5. Create default initial business and preserve legacy records
INSERT INTO public.businesses (id, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000001'::uuid, 'WholesaleIQ Primary', now())
ON CONFLICT (id) DO NOTHING;

-- Populate default business_id where null
UPDATE public.customers SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;
UPDATE public.products SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;
UPDATE public.sales SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;
UPDATE public.customer_payments SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;
UPDATE public.inventory_snapshots SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;
UPDATE public.product_cost_history SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;
UPDATE public.market_prices SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;
UPDATE public.customer_price_history SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;
UPDATE public.import_jobs SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;
UPDATE public.audit_logs SET business_id = '00000000-0000-0000-0000-000000000001'::uuid WHERE business_id IS NULL;

-- 6. Grants
GRANT SELECT, INSERT, UPDATE ON public.businesses TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_memberships TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invitations TO authenticated, anon;

-- 7. Function: Create a new business account and assign creator as Owner
CREATE OR REPLACE FUNCTION public.create_new_business(_name text, _settings jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_bid uuid;
  creator uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid);
BEGIN
  IF trim(coalesce(_name, '')) = '' THEN
    RAISE EXCEPTION 'Business name cannot be blank';
  END IF;

  INSERT INTO public.businesses (name, created_by, settings)
  VALUES (trim(_name), creator, _settings)
  RETURNING id INTO new_bid;

  INSERT INTO public.business_memberships (business_id, user_id, role, status)
  VALUES (new_bid, creator, 'owner', 'active');

  INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, new_data, business_id)
  VALUES ('businesses', new_bid, 'CREATE_BUSINESS', creator, jsonb_build_object('name', _name), new_bid);

  RETURN new_bid;
END $$;

GRANT EXECUTE ON FUNCTION public.create_new_business(text, jsonb) TO authenticated, anon;

-- 8. Function: Update membership role with Last Owner Protection
CREATE OR REPLACE FUNCTION public.update_membership_role(_business_id uuid, _target_user uuid, _new_role text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_role text;
  caller_role text;
  caller uuid := coalesce(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid);
  owner_count int;
BEGIN
  -- Caller must be owner or admin
  SELECT role INTO caller_role FROM public.business_memberships
  WHERE business_id = _business_id AND user_id = caller AND status = 'active';

  IF caller_role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Only an Owner or Admin can modify team roles';
  END IF;

  SELECT role INTO current_role FROM public.business_memberships
  WHERE business_id = _business_id AND user_id = _target_user;

  -- Protect the last owner: Cannot downgrade or remove if only 1 active owner remains
  IF current_role = 'owner' AND _new_role <> 'owner' THEN
    SELECT count(*) INTO owner_count FROM public.business_memberships
    WHERE business_id = _business_id AND role = 'owner' AND status = 'active';

    IF owner_count <= 1 THEN
      RAISE EXCEPTION 'Cannot change role: A business must retain at least one active Owner';
    END IF;
  END IF;

  UPDATE public.business_memberships
  SET role = _new_role
  WHERE business_id = _business_id AND user_id = _target_user;

  INSERT INTO public.audit_logs (table_name, record_id, action, changed_by, new_data, business_id)
  VALUES ('business_memberships', _target_user, 'ROLE_CHANGE', caller, jsonb_build_object('new_role', _new_role), _business_id);

  RETURN true;
END $$;

GRANT EXECUTE ON FUNCTION public.update_membership_role(uuid, uuid, text) TO authenticated, anon;
