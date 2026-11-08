
create type public.app_role as enum ('owner','management','staff');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text, email text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null, unique(user_id, role)
);
grant select, update on public.profiles to authenticated; grant all on public.profiles to service_role;
grant select on public.user_roles to authenticated; grant all on public.user_roles to service_role;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role) $$;
create or replace function public.is_finance(_user_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role in ('owner','management')) $$;

create policy "own profile read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'owner'));
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());
create policy "own roles read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'owner'));

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email,'@',1)), new.email);
  if not exists (select 1 from public.user_roles where role='owner') then
    insert into public.user_roles(user_id, role) values (new.id,'owner');
  else
    insert into public.user_roles(user_id, role) values (new.id,'staff');
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Core business tables
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  code text unique, name text not null, contact_person text, phone text, address text, town text,
  category text not null default 'Retailer', is_active boolean not null default true, is_sample boolean not null default false,
  created_by uuid, updated_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.products (
  id uuid primary key default gen_random_uuid(),
  sku text unique, name text not null, category text not null, unit text not null default 'kg', pack_size_kg numeric(10,2),
  is_sample boolean not null default false, created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.suppliers (
  id uuid primary key default gen_random_uuid(), name text not null, phone text, town text,
  is_sample boolean not null default false, created_by uuid, created_at timestamptz not null default now()
);
create table public.sales (
  id uuid primary key default gen_random_uuid(), invoice_no text unique, customer_id uuid not null references public.customers(id),
  sale_date date not null, total_amount numeric(14,2) not null default 0, total_cost numeric(14,2) not null default 0,
  due_date date, is_void boolean not null default false, is_sample boolean not null default false,
  created_by uuid, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.sale_items (
  id uuid primary key default gen_random_uuid(), sale_id uuid not null references public.sales(id),
  product_id uuid not null references public.products(id), quantity_kg numeric(12,2) not null,
  unit_price numeric(12,2) not null, unit_cost numeric(12,2) not null, line_total numeric(14,2) not null,
  created_at timestamptz not null default now()
);
create table public.customer_payments (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
  payment_date date not null, amount numeric(14,2) not null, method text, reference text, is_void boolean not null default false,
  is_sample boolean not null default false, created_by uuid, created_at timestamptz not null default now()
);
create table public.customer_ledger_entries (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
  entry_date date not null, entry_type text not null, debit numeric(14,2) not null default 0, credit numeric(14,2) not null default 0,
  sale_id uuid references public.sales(id), payment_id uuid references public.customer_payments(id), note text,
  created_by uuid, created_at timestamptz not null default now()
);
create table public.credit_limits (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id),
  credit_limit numeric(14,2) not null, credit_days int not null default 30, effective_from date not null default current_date,
  created_by uuid, created_at timestamptz not null default now()
);
create table public.purchases (
  id uuid primary key default gen_random_uuid(), supplier_id uuid references public.suppliers(id), product_id uuid not null references public.products(id),
  purchase_date date not null, quantity_kg numeric(12,2) not null, unit_cost numeric(12,2) not null, freight_per_kg numeric(10,2) not null default 0,
  godown text, is_sample boolean not null default false, created_by uuid, created_at timestamptz not null default now()
);
create table public.expenses (
  id uuid primary key default gen_random_uuid(), expense_date date not null, category text not null, amount numeric(14,2) not null,
  note text, created_by uuid, created_at timestamptz not null default now()
);
create table public.product_cost_history (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
  effective_date date not null, landed_cost numeric(12,2) not null, source text, created_by uuid, created_at timestamptz not null default now()
);
create table public.customer_price_history (
  id uuid primary key default gen_random_uuid(), customer_id uuid not null references public.customers(id), product_id uuid not null references public.products(id),
  effective_date date not null, price numeric(12,2) not null, created_by uuid, created_at timestamptz not null default now()
);
create table public.market_prices (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
  price_date date not null, source_type text not null default 'market', source_name text, price numeric(12,2) not null,
  created_by uuid, created_at timestamptz not null default now()
);
create table public.inventory_snapshots (
  id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id), godown text not null,
  snapshot_date date not null, quantity_kg numeric(12,2) not null, avg_cost numeric(12,2) not null,
  created_by uuid, created_at timestamptz not null default now()
);
create table public.import_jobs (
  id uuid primary key default gen_random_uuid(), file_name text not null, target_table text not null, status text not null default 'validated',
  total_rows int not null default 0, valid_rows int not null default 0, error_rows int not null default 0, duplicate_rows int not null default 0,
  errors jsonb, created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(), table_name text not null, record_id uuid, action text not null,
  changed_by uuid, old_data jsonb, new_data jsonb, created_at timestamptz not null default now()
);

-- Grants
grant select, insert, update on public.customers, public.products, public.suppliers to authenticated;
grant select, insert, update on public.sales, public.sale_items, public.customer_payments, public.customer_ledger_entries, public.credit_limits,
  public.purchases, public.expenses, public.product_cost_history, public.customer_price_history, public.market_prices, public.inventory_snapshots to authenticated;
grant select, insert on public.import_jobs to authenticated;
grant select on public.audit_logs to authenticated;
grant all on public.customers, public.products, public.suppliers, public.sales, public.sale_items, public.customer_payments, public.customer_ledger_entries,
  public.credit_limits, public.purchases, public.expenses, public.product_cost_history, public.customer_price_history, public.market_prices,
  public.inventory_snapshots, public.import_jobs, public.audit_logs to service_role;

-- RLS
do $$ declare t text; begin
  foreach t in array array['customers','products','suppliers','sales','sale_items','customer_payments','customer_ledger_entries','credit_limits','purchases','expenses','product_cost_history','customer_price_history','market_prices','inventory_snapshots','import_jobs','audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
  -- operational tables: all signed-in roles read; finance roles write
  foreach t in array array['customers','products','suppliers'] loop
    execute format('create policy "team read" on public.%I for select to authenticated using (public.has_role(auth.uid(),''owner'') or public.has_role(auth.uid(),''management'') or public.has_role(auth.uid(),''staff''))', t);
    execute format('create policy "finance insert" on public.%I for insert to authenticated with check (public.is_finance(auth.uid()))', t);
    execute format('create policy "finance update" on public.%I for update to authenticated using (public.is_finance(auth.uid()))', t);
  end loop;
  -- financial tables: finance roles only; no delete policies (no silent deletion)
  foreach t in array array['sales','sale_items','customer_payments','customer_ledger_entries','credit_limits','purchases','expenses','product_cost_history','customer_price_history','market_prices','inventory_snapshots'] loop
    execute format('create policy "finance read" on public.%I for select to authenticated using (public.is_finance(auth.uid()))', t);
    execute format('create policy "finance insert" on public.%I for insert to authenticated with check (public.is_finance(auth.uid()))', t);
    execute format('create policy "finance update" on public.%I for update to authenticated using (public.is_finance(auth.uid()))', t);
  end loop;
end $$;
create policy "finance read" on public.import_jobs for select to authenticated using (public.is_finance(auth.uid()));
create policy "finance insert" on public.import_jobs for insert to authenticated with check (public.is_finance(auth.uid()) and created_by = auth.uid());
create policy "owner read" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'owner'));

-- Audit trigger
create or replace function public.audit_trigger() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs(table_name, record_id, action, changed_by, old_data, new_data)
  values (tg_table_name, coalesce((to_jsonb(new)->>'id')::uuid,(to_jsonb(old)->>'id')::uuid), tg_op, auth.uid(),
    case when tg_op<>'INSERT' then to_jsonb(old) end, case when tg_op<>'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end $$;
do $$ declare t text; begin
  foreach t in array array['customers','products','sales','customer_payments','credit_limits','customer_price_history','market_prices','product_cost_history'] loop
    execute format('create trigger audit_%1$s after update or delete on public.%1$I for each row execute function public.audit_trigger()', t);
  end loop;
end $$;

-- ===== SAMPLE DATA (fictional, flagged is_sample) =====
insert into public.products (sku,name,category,unit,pack_size_kg,is_sample) values
('SUG-50','Sugar (S-30)','Sugar','kg',50,true),
('MAI-50','Maida','Flour','kg',50,true),
('ATT-30','Chakki Atta','Flour','kg',30,true),
('SUJ-30','Suji','Flour','kg',30,true),
('OIL-15','Mustard Oil (15 L tin)','Edible Oil','kg',15,true),
('OIL-SB','Soyabean Oil (15 L tin)','Edible Oil','kg',15,true),
('DAL-MSR','Masoor Dal','Dals','kg',50,true),
('DAL-MNG','Moong Dal','Dals','kg',30,true),
('DAL-CHN','Chana Dal','Dals','kg',30,true),
('MAS-HLD','Turmeric Powder','Masalas','kg',25,true);

insert into public.customers (code,name,contact_person,phone,town,category,is_sample) values
('C001','Maa Tara Bhandar','Subrata Ghosh','98000 00001','Berhampore','Retailer',true),
('C002','Annapurna Sweets','Kakoli Das','98000 00002','Berhampore','Sweet Shop',true),
('C003','Lalbagh Grocery Mart','Rafiq Sheikh','98000 00003','Lalbagh','Wholesaler',true),
('C004','Jiaganj Traders','Pradip Saha','98000 00004','Jiaganj','Wholesaler',true),
('C005','Sri Krishna Hotel','Biswajit Mondal','98000 00005','Berhampore','Hotel / Restaurant',true),
('C006','Kandi Bazar Stores','Anwar Hossain','98000 00006','Kandi','Retailer',true),
('C007','New Bakery Udyog','Tapan Pal','98000 00007','Beldanga','Bakery',true),
('C008','Domkal Food Supply','Mizanur Rahman','98000 00008','Domkal','Wholesaler',true),
('C009','Ganga Kirana','Rita Sarkar','98000 00009','Berhampore','Retailer',true),
('C010','Hari Om Caterers','Gopal Dey','98000 00010','Berhampore','Caterer',true),
('C011','Farakka Provision','Sanjib Roy','98000 00011','Farakka','Retailer',true),
('C012','Murshidabad Mishti Ghar','Ananya Bose','98000 00012','Murshidabad','Sweet Shop',true);

insert into public.suppliers (name,town,is_sample) values ('Bengal Sugar Agencies','Kolkata',true),('Eastern Flour Mills','Durgapur',true),('Shree Oils Pvt (fictional)','Kolkata',true);

-- base cost per product
create temp table base_cost(sku text, cost numeric);
insert into base_cost values ('SUG-50',39.5),('MAI-50',31),('ATT-30',29),('SUJ-30',34),('OIL-15',148),('OIL-SB',122),('DAL-MSR',72),('DAL-MNG',96),('DAL-CHN',68),('MAS-HLD',165);

-- landed cost history (weekly for 13 weeks, with drift)
insert into public.product_cost_history (product_id, effective_date, landed_cost, source)
select p.id, current_date - (w*7), round((b.cost * (1 + 0.04*sin(w/2.0 + length(p.sku)) + 0.002*w))::numeric,2), 'Sample purchase invoice'
from public.products p join base_cost b on b.sku=p.sku, generate_series(0,12) w;

-- market & competitor prices
insert into public.market_prices (product_id, price_date, source_type, source_name, price)
select p.id, current_date - (w*7), 'market', 'Kolkata mandi reference (sample)', round((b.cost * (1.06 + 0.05*sin(w/2.0 + length(p.sku)) - 0.003*w))::numeric,2)
from public.products p join base_cost b on b.sku=p.sku, generate_series(0,12) w;
insert into public.market_prices (product_id, price_date, source_type, source_name, price)
select p.id, current_date - (w*7), 'competitor', c.n, round((b.cost * (c.f + 0.02*cos(w + length(p.sku))))::numeric,2)
from public.products p join base_cost b on b.sku=p.sku, generate_series(0,4) w,
 (values ('Competitor A – Khagra (sample)',1.05),('Competitor B – Gorabazar (sample)',1.08)) c(n,f);

-- customer price history: price factor per customer
create temp table cust_factor as select id, code, 1.04 + (substring(code,2)::int % 5)*0.025 as f from public.customers;
insert into public.customer_price_history (customer_id, product_id, effective_date, price)
select cf.id, p.id, current_date - (m*30), round((b.cost*(cf.f - 0.01*m) + case when cf.code='C004' and p.sku='SUG-50' then -2.5 else 0 end)::numeric,2)
from cust_factor cf cross join public.products p join base_cost b on b.sku=p.sku, generate_series(0,2) m;

-- sales: ~ 3 per customer per week over 90 days
insert into public.sales (invoice_no, customer_id, sale_date, due_date, is_sample)
select 'S-' || to_char(current_date - d,'YYMMDD') || '-' || cf.code, cf.id, current_date - d, current_date - d + 30, true
from cust_factor cf, generate_series(0,89) d
where (abs(hashtext(cf.code || d::text)) % 7) < case when cf.code in ('C003','C004','C008') then 4 else 2 end;

insert into public.sale_items (sale_id, product_id, quantity_kg, unit_price, unit_cost, line_total)
select s.id, p.id, q.qty, q.price, q.cost, round(q.qty*q.price,2)
from public.sales s join cust_factor cf on cf.id=s.customer_id
cross join lateral (select * from public.products p2 where abs(hashtext(s.invoice_no || p2.sku)) % 4 = 0 limit 3) p
join base_cost b on b.sku=p.sku
cross join lateral (select
   (p.pack_size_kg * (1 + abs(hashtext(s.invoice_no||p.sku||'q')) % case when cf.code in ('C003','C004','C008') then 8 else 3 end))::numeric as qty,
   round((b.cost*cf.f + case when cf.code='C004' and p.sku='SUG-50' then -2.5 else 0 end)::numeric,2) as price,
   round(b.cost::numeric,2) as cost) q;

update public.sales s set total_amount = t.amt, total_cost = t.cost
from (select sale_id, sum(line_total) amt, sum(quantity_kg*unit_cost) cost from public.sale_items group by sale_id) t where t.sale_id = s.id;

-- payments: most customers pay ~85%, a few lag
insert into public.customer_payments (customer_id, payment_date, amount, method, reference, is_sample)
select cf.id, current_date - (w*7), round((sum(s.total_amount) * case when cf.code in ('C006','C010','C011') then 0.55 when cf.code in ('C004') then 0.75 else 0.92 end)::numeric,2),
 case when w%2=0 then 'UPI' else 'Bank transfer' end, 'PMT-' || cf.code || '-' || w, true
from cust_factor cf join public.sales s on s.customer_id=cf.id, generate_series(1,12) w
where s.sale_date between current_date - (w*7) - 13 and current_date - (w*7) - 7
group by cf.id, cf.code, w having sum(s.total_amount) > 0;

insert into public.customer_ledger_entries (customer_id, entry_date, entry_type, debit, sale_id, note)
select customer_id, sale_date, 'sale', total_amount, id, invoice_no from public.sales;
insert into public.customer_ledger_entries (customer_id, entry_date, entry_type, credit, payment_id, note)
select customer_id, payment_date, 'payment', amount, id, reference from public.customer_payments;

insert into public.credit_limits (customer_id, credit_limit, credit_days)
select id, case when code in ('C003','C004','C008') then 800000 when code in ('C002','C005','C010','C012') then 300000 else 150000 end,
 case when code in ('C003','C004','C008') then 30 else 15 end from public.customers;

insert into public.inventory_snapshots (product_id, godown, snapshot_date, quantity_kg, avg_cost)
select p.id, g, current_date, (p.pack_size_kg * (20 + abs(hashtext(p.sku||g)) % 120))::numeric, b.cost
from public.products p join base_cost b on b.sku=p.sku,
 unnest(array['Main Shop','Godown 1 – Khagra','Godown 2 – Gorabazar','Godown 3 – Panchanantala','Godown 4 – Indraprastha','Godown 5 – Chuanpur','Godown 6 – Banjetia']) g;

insert into public.purchases (supplier_id, product_id, purchase_date, quantity_kg, unit_cost, freight_per_kg, godown, is_sample)
select (select id from public.suppliers order by name limit 1 offset (abs(hashtext(p.sku)) % 3)), p.id, current_date - (w*14), p.pack_size_kg*200, b.cost - 0.8, 0.8, 'Godown 1 – Khagra', true
from public.products p join base_cost b on b.sku=p.sku, generate_series(0,5) w;

-- views (security invoker so RLS applies)
create view public.v_customer_summary with (security_invoker = true) as
select c.id, c.code, c.name, c.category, c.town, c.phone, c.contact_person, c.is_sample,
  coalesce(s.sales,0) total_sales, coalesce(s.cost,0) total_cost, coalesce(s.sales,0)-coalesce(s.cost,0) gross_profit,
  coalesce(s.n,0) invoice_count, s.last_date last_purchase_date,
  coalesce(s.sales,0) - coalesce(p.paid,0) outstanding,
  coalesce(o.overdue,0) overdue,
  cl.credit_limit, cl.credit_days
from public.customers c
left join (select customer_id, sum(total_amount) sales, sum(total_cost) cost, count(*) n, max(sale_date) last_date from public.sales where not is_void group by customer_id) s on s.customer_id=c.id
left join (select customer_id, sum(amount) paid from public.customer_payments where not is_void group by customer_id) p on p.customer_id=c.id
left join lateral (select credit_limit, credit_days from public.credit_limits where customer_id=c.id order by effective_from desc, created_at desc limit 1) cl on true
left join lateral (
  select greatest(0, coalesce((select sum(total_amount) from public.sales where customer_id=c.id and not is_void and sale_date < current_date - coalesce(cl.credit_days,30)),0) - coalesce(p.paid,0)) overdue
) o on true;
grant select on public.v_customer_summary to authenticated;
