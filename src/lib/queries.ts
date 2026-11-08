import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getDataSource } from "./data-source";
import { getDemonstrationData, getDemoCustomerSummary, DEMO_PRODUCTS_RAW } from "./demo-data";

async function all<T>(q: PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const { data, error } = await q;
  if (error) {
    console.warn("Supabase query error:", error.message);
    return [];
  }
  return data ?? [];
}

export const customerSummaryQuery = () => {
  const activeBizId =
    typeof window !== "undefined"
      ? localStorage.getItem("wholesaleiq_active_business_id") || undefined
      : undefined;

  return queryOptions({
    queryKey: ["customer-summary", getDataSource(), activeBizId || "default"],
    queryFn: async () => {
      const isDemo = getDataSource() === "demo";
      const rows = await all(
        supabase
          .from("v_customer_summary")
          .select("*")
          .eq("is_sample", isDemo)
          .order("total_sales", { ascending: false }),
      );
      if (rows.length === 0 && isDemo) {
        return getDemoCustomerSummary();
      }

      // Merge locally stored / imported customer records in real mode
      if (!isDemo) {
        const { getLocalStoredCustomers } = await import("./customer-store");
        const localCustomers = getLocalStoredCustomers(activeBizId);
        if (localCustomers.length > 0) {
          const map = new Map<string, (typeof rows)[0]>();
          for (const r of rows) if (r.code) map.set(r.code.toLowerCase(), r);
          for (const c of localCustomers) {
            const key = c.code.toLowerCase();
            if (!map.has(key)) {
              map.set(key, {
                id: c.id,
                code: c.code,
                name: c.name,
                category: c.category,
                town: c.town || "Berhampore",
                phone: c.phone || "",
                contact_person: c.contact_person || "",
                is_sample: false,
                total_sales: c.total_sales,
                total_cost: Math.round(c.total_sales * 0.88),
                gross_profit: c.gross_profit,
                invoice_count: c.invoice_count,
                last_purchase_date: c.last_purchase_date || "",
                outstanding: c.outstanding,
                overdue: 0,
                credit_limit: c.credit_limit,
                credit_days: c.credit_days,
              });
            }
          }
          return Array.from(map.values()).sort(
            (a, b) => (b.total_sales ?? 0) - (a.total_sales ?? 0),
          );
        }
      }

      return rows;
    },
  });
};

export const productsQuery = () =>
  queryOptions({
    queryKey: ["products", getDataSource()],
    queryFn: async () => {
      const isDemo = getDataSource() === "demo";
      const rows = await all(
        supabase.from("products").select("*").eq("is_sample", isDemo).order("name"),
      );
      if (rows.length === 0 && isDemo) {
        return DEMO_PRODUCTS_RAW;
      }
      return rows;
    },
  });

export const salesSinceQuery = (since: string, until: string) =>
  queryOptions({
    queryKey: ["sales", getDataSource(), since, until],
    queryFn: async () => {
      const isDemo = getDataSource() === "demo";
      const rows: {
        id: string;
        customer_id: string;
        sale_date: string;
        total_amount: number;
        total_cost: number;
      }[] = [];
      for (let from = 0; ; from += 1000) {
        const batch = await all(
          supabase
            .from("sales")
            .select("id,customer_id,sale_date,total_amount,total_cost")
            .eq("is_void", false)
            .eq("is_sample", isDemo)
            .gte("sale_date", since)
            .lte("sale_date", until)
            .order("sale_date")
            .range(from, from + 999),
        );
        rows.push(...batch);
        if (batch.length < 1000) break;
      }
      if (rows.length === 0 && isDemo) {
        const demoDb = getDemonstrationData();
        return demoDb.sales
          .filter((s) => !s.is_void && s.sale_date >= since && s.sale_date <= until)
          .map((s) => ({
            id: s.id,
            customer_id: s.customer_id,
            sale_date: s.sale_date,
            total_amount: s.total_amount,
            total_cost: s.total_cost,
          }));
      }
      return rows;
    },
  });

export const saleItemsSinceQuery = (since: string, until: string) =>
  queryOptions({
    queryKey: ["sale-items", getDataSource(), since, until],
    queryFn: async () => {
      const isDemo = getDataSource() === "demo";
      const rows: {
        product_id: string;
        quantity_kg: number;
        unit_price: number;
        unit_cost: number;
        line_total: number;
        sales: { sale_date: string; customer_id: string } | null;
      }[] = [];
      for (let from = 0; ; from += 1000) {
        const batch = await all(
          supabase
            .from("sale_items")
            .select(
              "product_id,quantity_kg,unit_price,unit_cost,line_total,sales!inner(sale_date,customer_id,is_void)",
            )
            .gte("sales.sale_date", since)
            .lte("sales.sale_date", until)
            .eq("sales.is_void", false)
            .eq("sales.is_sample", isDemo)
            .order("id")
            .range(from, from + 999),
        );
        rows.push(...(batch as unknown as typeof rows));
        if (batch.length < 1000) break;
      }
      if (rows.length === 0 && isDemo) {
        const demoDb = getDemonstrationData();
        const salesMap = new Map(demoDb.sales.map((s) => [s.id, s]));
        return demoDb.items
          .filter((i) => {
            const s = salesMap.get(i.sale_id);
            return s && !s.is_void && s.sale_date >= since && s.sale_date <= until;
          })
          .map((i) => {
            const s = salesMap.get(i.sale_id)!;
            return {
              product_id: i.product_id,
              quantity_kg: i.quantity_kg,
              unit_price: i.unit_price,
              unit_cost: i.unit_cost,
              line_total: i.line_total,
              sales: { sale_date: s.sale_date, customer_id: s.customer_id },
            };
          });
      }
      return rows;
    },
  });

export const costHistoryQuery = () =>
  queryOptions({
    queryKey: ["cost-history", getDataSource()],
    queryFn: async () => {
      const isDemo = getDataSource() === "demo";
      const today = new Date().toISOString().slice(0, 10);
      const rows = await all(
        supabase
          .from("product_cost_history")
          .select("*, products!inner(is_sample)")
          .eq("products.is_sample", isDemo)
          .eq("is_void", false)
          .lte("effective_date", today)
          .order("effective_date"),
      );
      if (rows.length === 0 && isDemo) {
        const demoDb = getDemonstrationData();
        return demoDb.costs
          .filter((c) => !c.is_void && c.effective_date <= today)
          .map((c) => ({
            id: `${c.product_id}-${c.effective_date}`,
            product_id: c.product_id,
            effective_date: c.effective_date,
            landed_cost: c.landed_cost,
            is_void: c.is_void,
          }));
      }
      return rows;
    },
  });

export const marketPricesQuery = () =>
  queryOptions({
    queryKey: ["market-prices", getDataSource()],
    queryFn: async () => {
      const isDemo = getDataSource() === "demo";
      const today = new Date().toISOString().slice(0, 10);
      const rows = await all(
        supabase
          .from("market_prices")
          .select("*, products!inner(is_sample)")
          .eq("products.is_sample", isDemo)
          .eq("is_void", false)
          .lte("price_date", today)
          .order("price_date"),
      );
      if (rows.length === 0 && isDemo) {
        return [];
      }
      return rows;
    },
  });

export const customerPricesQuery = () =>
  queryOptions({
    queryKey: ["customer-prices", getDataSource()],
    queryFn: async () => {
      const isDemo = getDataSource() === "demo";
      const today = new Date().toISOString().slice(0, 10);
      const rows = await all(
        supabase
          .from("customer_price_history")
          .select("*, customers!inner(name,is_sample), products!inner(name,is_sample)")
          .eq("customers.is_sample", isDemo)
          .eq("products.is_sample", isDemo)
          .eq("is_void", false)
          .lte("effective_date", today)
          .order("effective_date"),
      );
      if (rows.length === 0 && isDemo) {
        const demoDb = getDemonstrationData();
        const cMap = new Map(demoDb.customers.map((c) => [c.id, c.name]));
        const pMap = new Map(demoDb.products.map((p) => [p.id, p.name]));
        return demoDb.prices
          .filter((cp) => !cp.is_void && cp.effective_date <= today)
          .map((cp) => ({
            id: `${cp.customer_id}-${cp.product_id}-${cp.effective_date}`,
            customer_id: cp.customer_id,
            product_id: cp.product_id,
            effective_date: cp.effective_date,
            price: cp.price,
            is_void: cp.is_void,
            customers: { name: cMap.get(cp.customer_id) ?? "", is_sample: true },
            products: { name: pMap.get(cp.product_id) ?? "", is_sample: true },
          }));
      }
      return rows;
    },
  });

export const inventoryQuery = () =>
  queryOptions({
    queryKey: ["inventory", getDataSource()],
    queryFn: async () => {
      const isDemo = getDataSource() === "demo";
      const today = new Date().toISOString().slice(0, 10);
      const rows = await all(
        supabase
          .from("inventory_snapshots")
          .select("*, products!inner(is_sample)")
          .eq("products.is_sample", isDemo)
          .lte("snapshot_date", today)
          .order("snapshot_date"),
      );
      if (rows.length === 0 && isDemo) {
        const demoDb = getDemonstrationData();
        return demoDb.inventory.map((inv) => ({
          id: `${inv.product_id}-${inv.godown}`,
          product_id: inv.product_id,
          godown: inv.godown,
          snapshot_date: inv.snapshot_date,
          quantity_kg: inv.quantity_kg,
          avg_cost: inv.avg_cost,
        }));
      }
      return [
        ...latestBy(
          rows,
          (r) => `${r.product_id}|${r.godown}`,
          (r) => r.snapshot_date,
        ).values(),
      ];
    },
  });

export const purchasesQuery = () =>
  queryOptions({
    queryKey: ["purchases", getDataSource()],
    queryFn: () =>
      all(
        supabase
          .from("purchases")
          .select("*, products!inner(name, sku, is_sample)")
          .eq("is_sample", getDataSource() === "demo")
          .order("purchase_date", { ascending: false }),
      ),
  });

/** Latest record per key */
export function latestBy<T>(rows: T[], key: (r: T) => string, date: (r: T) => string) {
  const m = new Map<string, T>();
  for (const r of rows) {
    const k = key(r);
    const cur = m.get(k);
    if (!cur || date(r) >= date(cur)) m.set(k, r);
  }
  return m;
}
