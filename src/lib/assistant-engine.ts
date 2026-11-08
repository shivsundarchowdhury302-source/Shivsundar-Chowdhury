import type { Database } from "@/integrations/supabase/types";
import {
  grossProfit,
  grossMargin,
  outstanding,
  overdueAmount,
  estimatedExposure,
} from "./financial";
import { inrP, pct, num } from "./format";
import { checkPeriod, type Plan } from "./assistant-schema";

type Row<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type BusinessData = {
  customers: Pick<Row<"customers">, "id" | "name" | "code">[];
  products: Pick<Row<"products">, "id" | "name" | "sku">[];
  sales: Pick<
    Row<"sales">,
    | "id"
    | "customer_id"
    | "sale_date"
    | "total_amount"
    | "total_cost"
    | "due_date"
    | "payment_type"
    | "is_void"
  >[];
  items: Pick<
    Row<"sale_items">,
    "id" | "sale_id" | "product_id" | "quantity_kg" | "unit_price" | "unit_cost" | "line_total"
  >[];
  payments: Pick<
    Row<"customer_payments">,
    "id" | "customer_id" | "payment_date" | "amount" | "is_void"
  >[];
  allocations: Pick<Row<"payment_allocations">, "payment_id" | "sale_id" | "amount">[];
  limits: Pick<Row<"credit_limits">, "customer_id" | "credit_limit" | "effective_from">[];
  costs: Pick<
    Row<"product_cost_history">,
    "product_id" | "effective_date" | "landed_cost" | "is_void"
  >[];
  prices: Pick<
    Row<"customer_price_history">,
    "customer_id" | "product_id" | "effective_date" | "price" | "is_void"
  >[];
  inventory: Pick<
    Row<"inventory_snapshots">,
    "product_id" | "godown" | "snapshot_date" | "quantity_kg" | "avg_cost"
  >[];
  market_prices: Pick<
    Row<"market_prices">,
    "id" | "product_id" | "price_date" | "source_name" | "price" | "is_void"
  >[];
  suppliers: Pick<Row<"suppliers">, "id" | "name" | "phone" | "town">[];
  purchases: Pick<
    Row<"purchases">,
    | "id"
    | "supplier_id"
    | "product_id"
    | "purchase_date"
    | "quantity_kg"
    | "unit_cost"
    | "freight_per_kg"
    | "godown"
  >[];
  expenses: Pick<Row<"expenses">, "id" | "expense_date" | "category" | "amount" | "note">[];
};
export const emptyBusinessData = (): BusinessData => ({
  customers: [],
  products: [],
  sales: [],
  items: [],
  payments: [],
  allocations: [],
  limits: [],
  costs: [],
  prices: [],
  inventory: [],
  market_prices: [],
  suppliers: [],
  purchases: [],
  expenses: [],
});
export type Answer = {
  status: "ok" | "empty" | "unsupported" | "forbidden" | "error";
  title: string;
  period: string;
  summary: string;
  columns: string[];
  rows: string[][];
  basis: string;
  notes: string[];
  source: "real" | "demo";
  interpretation: "rules" | "ai";
};
export function financeAllowed(roles: string[]) {
  return roles.includes("owner") || roles.includes("management");
}
export function invoiceBalance(
  sale: BusinessData["sales"][number],
  db: BusinessData,
  asOf: string,
) {
  const valid = new Set(
    db.payments
      .filter((p) => !p.is_void && p.customer_id === sale.customer_id && p.payment_date <= asOf)
      .map((p) => p.id),
  );
  const allocated = db.allocations
    .filter((a) => a.sale_id === sale.id && valid.has(a.payment_id))
    .reduce((s, a) => s + Number(a.amount), 0);
  return sale.is_void || sale.payment_type !== "credit"
    ? 0
    : outstanding(Number(sale.total_amount), allocated);
}
function latest<T>(rows: T[], key: (row: T) => string, date: (row: T) => string) {
  const map = new Map<string, T>();
  for (const row of rows) {
    const old = map.get(key(row));
    if (!old || date(old) < date(row)) map.set(key(row), row);
  }
  return [...map.values()];
}
export function answerBusiness(
  plan: Plan,
  db: BusinessData,
  today: string,
  source: Answer["source"],
): Answer {
  const { from, to } = checkPeriod(plan, today);
  const asOf = [
    "outstanding",
    "overdue",
    "credit_limits",
    "ageing",
    "inventory",
    "exposure",
    "below_cost",
    "market_compare",
  ].includes(plan.intent);
  const answer: Answer = {
    status: "ok",
    title: "Business records",
    period: asOf ? `As of ${to}` : `${from} to ${to}`,
    summary: "",
    columns: [],
    rows: [],
    basis: "",
    notes: [],
    source,
    interpretation: "rules",
  };
  if (source === "demo") answer.notes.push("Demonstration records only; excluded from Real data.");
  if (plan.intent === "unsupported")
    return {
      ...answer,
      status: "unsupported",
      summary:
        "This question is outside the supported customer, credit, product, pricing and inventory reports.",
      basis: "No figures calculated.",
    };
  const customers = db.customers.filter(
    (c) =>
      !plan.customer ||
      `${c.name} ${c.code ?? ""}`.toLowerCase().includes(plan.customer.toLowerCase()),
  );
  const products = db.products.filter(
    (p) =>
      !plan.product ||
      `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(plan.product.toLowerCase()),
  );
  const customerIds = new Set(customers.map((c) => c.id));
  const productIds = new Set(products.map((p) => p.id));
  const allSales = db.sales.filter(
    (s) => !s.is_void && s.sale_date <= to && customerIds.has(s.customer_id),
  );
  const sales = allSales.filter((s) => s.sale_date >= from);
  const saleIds = new Set(sales.map((s) => s.id));
  const items = db.items.filter((i) => saleIds.has(i.sale_id) && productIds.has(i.product_id));
  const costRows = db.costs.filter(
    (c) => !c.is_void && c.effective_date <= to && productIds.has(c.product_id),
  );
  const inventory = latest(
    db.inventory.filter((i) => i.snapshot_date <= to && productIds.has(i.product_id)),
    (i) => `${i.product_id}|${i.godown}`,
    (i) => i.snapshot_date,
  );
  const pName = (id: string) => db.products.find((p) => p.id === id)?.name ?? "Unknown product";
  const cName = (id: string) => db.customers.find((c) => c.id === id)?.name ?? "Unknown customer";
  if (["customer_profit", "customer_decline"].includes(plan.intent)) {
    const length = Date.parse(to) - Date.parse(from) + 86400000;
    const prevFrom = new Date(Date.parse(from) - length).toISOString().slice(0, 10);
    const prevTo = new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10);
    const rows = customers.map((c) => {
      const own = sales.filter((s) => s.customer_id === c.id);
      const revenue = own.reduce((sum, s) => sum + Number(s.total_amount), 0);
      const cost = own.reduce((sum, s) => sum + Number(s.total_cost), 0);
      const prev = allSales
        .filter((s) => s.customer_id === c.id && s.sale_date >= prevFrom && s.sale_date <= prevTo)
        .reduce((sum, s) => sum + Number(s.total_amount), 0);
      return {
        name: c.name,
        revenue,
        cost,
        profit: grossProfit(revenue, cost),
        prev,
        decline: prev - revenue,
        count: own.length,
      };
    });
    if (plan.intent === "customer_decline") {
      const ranked = rows.filter((r) => r.prev > r.revenue).sort((a, b) => b.decline - a.decline);
      answer.title = "Customers with reduced purchases";
      answer.columns = ["Customer", "Previous sales", "Current sales", "Decline", "% Decline"];
      answer.rows = ranked.map((r) => [
        r.name,
        inrP(r.prev),
        inrP(r.revenue),
        inrP(r.decline),
        pct(r.prev > 0 ? (r.decline / r.prev) * 100 : 0),
      ]);
      answer.summary = `${ranked.length} customers reduced purchases; total decline ${inrP(ranked.reduce((s, r) => s + r.decline, 0))}.`;
      answer.basis = `Compare invoice revenue against equal-length previous period ${prevFrom} to ${prevTo}. Payments excluded.`;
      if (!allSales.some((s) => s.sale_date >= prevFrom && s.sale_date <= prevTo))
        answer.notes.push(
          "No sales in the comparison period; purchase decline cannot be established.",
        );
    } else {
      const ranked = rows.filter((r) => r.count > 0).sort((a, b) => b.profit - a.profit);
      answer.title = "Customer gross profitability";
      answer.columns = ["Customer", "Revenue", "Landed COGS", "Gross profit", "Margin"];
      answer.rows = ranked.map((r) => [
        r.name,
        inrP(r.revenue),
        inrP(r.cost),
        inrP(r.profit),
        pct(grossMargin(r.revenue, r.cost)),
      ]);
      answer.summary = ranked[0]
        ? `${ranked[0].name} leads with gross profit of ${inrP(ranked[0].profit)}. Total gross profit: ${inrP(ranked.reduce((s, r) => s + r.profit, 0))}.`
        : "No sales recorded for this period.";
      answer.basis =
        "Gross profit = invoice revenue − recorded corresponding landed COGS. Margin = gross profit ÷ revenue × 100. Payments excluded. Value ranked by gross profit, not net profit.";
    }
    if (sales.some((s) => Number(s.total_cost) === 0))
      answer.notes.push(
        "Some invoices have zero recorded cost; confirm landed COGS before relying on their profitability.",
      );
  } else if (["outstanding", "overdue", "credit_limits", "ageing"].includes(plan.intent)) {
    const credit = allSales.filter((s) => s.payment_type === "credit");
    const limits = latest(
      db.limits.filter((l) => l.effective_from <= to),
      (l) => l.customer_id,
      (l) => l.effective_from,
    );
    const rows = customers.map((c) => {
      const own = credit.filter((s) => s.customer_id === c.id);
      const buckets = [0, 0, 0, 0, 0];
      let total = 0,
        overdue = 0,
        missing = 0;
      for (const s of own) {
        const unpaid = invoiceBalance(s, db, to);
        total += unpaid;
        overdue += overdueAmount(unpaid, s.due_date, to);
        if (!s.due_date && unpaid > 0) {
          missing += unpaid;
          continue;
        }
        const days = s.due_date
          ? Math.floor((Date.parse(to) - Date.parse(s.due_date)) / 86400000)
          : 0;
        const index = days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
        buckets[index] = (buckets[index] ?? 0) + unpaid;
      }
      const limit = limits.find((l) => l.customer_id === c.id)?.credit_limit;
      return {
        name: c.name,
        total,
        overdue,
        missing,
        buckets,
        limit: limit == null ? null : Number(limit),
      };
    });
    const ranked = rows
      .filter((r) =>
        plan.intent === "overdue"
          ? r.overdue > 0
          : plan.intent === "credit_limits"
            ? r.limit !== null && r.total > r.limit
            : r.total > 0,
      )
      .sort((a, b) => (plan.intent === "overdue" ? b.overdue - a.overdue : b.total - a.total));
    answer.title =
      plan.intent === "overdue"
        ? "Overdue payments"
        : plan.intent === "credit_limits"
          ? "Credit limits exceeded"
          : plan.intent === "ageing"
            ? "Payment ageing by customer"
            : "Outstanding credit";
    answer.columns =
      plan.intent === "ageing"
        ? [
            "Customer",
            "Not due",
            "1–30 days",
            "31–60 days",
            "61–90 days",
            "90+ days",
            "No due date",
          ]
        : ["Customer", "Outstanding", "Overdue", "Credit limit"];
    answer.rows = ranked.map((r) =>
      plan.intent === "ageing"
        ? [r.name, ...r.buckets.map(inrP), inrP(r.missing)]
        : [
            r.name,
            inrP(r.total),
            inrP(r.overdue),
            r.limit === null ? "Not recorded" : inrP(r.limit),
          ],
    );
    answer.summary = `Total outstanding credit: ${inrP(rows.reduce((s, r) => s + r.total, 0))}; overdue: ${inrP(rows.reduce((s, r) => s + r.overdue, 0))}. ${ranked.length} customers match this report.`;
    answer.basis =
      "Unpaid = non-void credit invoices − payments explicitly allocated to each invoice, received on or before the as-of date. Overdue means unpaid past due date; ageing is days past due. All invoice dates through the as-of date included.";
    const validPayments = db.payments.filter(
      (p) => !p.is_void && p.payment_date <= to && customerIds.has(p.customer_id),
    );
    const unallocated = validPayments.reduce(
      (sum, p) =>
        sum +
        Math.max(
          0,
          Number(p.amount) -
            db.allocations
              .filter((a) => a.payment_id === p.id)
              .reduce((s, a) => s + Number(a.amount), 0),
        ),
      0,
    );
    if (unallocated > 0)
      answer.notes.push(
        `${inrP(unallocated)} of payments are unallocated; they have not been silently deducted from invoices.`,
      );
    if (rows.some((r) => r.missing > 0))
      answer.notes.push(
        "Some unpaid invoices have no due date; shown separately and not assumed overdue.",
      );
    if (rows.some((r) => r.total > 0 && r.limit === null))
      answer.notes.push(
        "Some customers have no effective credit limit; limit breaches cannot be assessed for them.",
      );
  } else if (
    ["product_profit", "product_margin", "best_selling", "product_compare"].includes(plan.intent)
  ) {
    const length = Date.parse(to) - Date.parse(from) + 86400000;
    const prevFrom = new Date(Date.parse(from) - length).toISOString().slice(0, 10);
    const prevTo = new Date(Date.parse(from) - 86400000).toISOString().slice(0, 10);
    const prevIds = new Set(
      allSales.filter((s) => s.sale_date >= prevFrom && s.sale_date <= prevTo).map((s) => s.id),
    );
    const rows = products
      .map((p) => {
        const own = items.filter((i) => i.product_id === p.id);
        const revenue = own.reduce((s, i) => s + Number(i.line_total), 0);
        const cost = own.reduce((s, i) => s + Number(i.quantity_kg) * Number(i.unit_cost), 0);
        const previous = db.items.filter((i) => i.product_id === p.id && prevIds.has(i.sale_id));
        const prevRevenue = previous.reduce((s, i) => s + Number(i.line_total), 0);
        const salesDiff = revenue - prevRevenue;
        const salesPctChange =
          prevRevenue > 0
            ? (salesDiff / prevRevenue) * 100
            : revenue > 0
              ? 100
              : 0;
        const previousProfit = previous.reduce(
          (s, i) => s + Number(i.line_total) - Number(i.quantity_kg) * Number(i.unit_cost),
          0,
        );
        return {
          name: p.name,
          revenue,
          prevRevenue,
          salesDiff,
          salesPctChange,
          cost,
          profit: grossProfit(revenue, cost),
          margin: grossMargin(revenue, cost),
          kg: own.reduce((s, i) => s + Number(i.quantity_kg), 0),
          prevKg: previous.reduce((s, i) => s + Number(i.quantity_kg), 0),
          previousProfit,
          count: own.length + previous.length,
        };
      })
      .filter((r) => r.count > 0)
      .sort((a, b) =>
        plan.intent === "product_compare"
          ? Math.abs(b.salesDiff) - Math.abs(a.salesDiff)
          : plan.intent === "product_margin"
            ? a.margin - b.margin
            : plan.intent === "best_selling"
              ? b.kg - a.kg
              : b.profit - a.profit,
      );
    answer.title =
      plan.intent === "best_selling"
        ? "Best-selling products"
        : plan.intent === "product_margin"
          ? "Lowest product margins"
          : plan.intent === "product_compare"
            ? "Product sales performance comparison"
            : "Product gross profitability";
    answer.columns = [
      "Product",
      "Volume (kg)",
      plan.intent === "product_compare" ? "Current Sales" : "Revenue",
      ...(plan.intent === "product_compare"
        ? ["Previous sales", "Sales change", "% Sales change"]
        : []),
      "Landed COGS",
      "Gross profit",
      "Margin",
      ...(plan.intent === "product_compare" ? ["Previous profit", "% Profit change"] : []),
    ];
    answer.rows = rows.map((r) => [
      r.name,
      num(r.kg),
      inrP(r.revenue),
      ...(plan.intent === "product_compare"
        ? [inrP(r.prevRevenue), inrP(r.salesDiff), pct(r.salesPctChange)]
        : []),
      inrP(r.cost),
      inrP(r.profit),
      pct(r.margin),
      ...(plan.intent === "product_compare"
        ? [
            inrP(r.previousProfit),
            pct(
              r.previousProfit !== 0
                ? ((r.profit - r.previousProfit) / Math.abs(r.previousProfit)) * 100
                : r.profit > 0
                  ? 100
                  : 0,
            ),
          ]
        : []),
    ]);
    if (plan.intent === "product_compare") {
      const topMover = rows[0];
      answer.summary = topMover
        ? `${topMover.name} had the largest change in sales (${inrP(topMover.salesDiff)}, ${pct(topMover.salesPctChange)}) compared with the previous month. Total period sales: ${inrP(rows.reduce((s, r) => s + r.revenue, 0))}.`
        : "No matching sale items recorded for the comparison periods.";
    } else {
      answer.summary = rows[0]
        ? `${rows[0].name} ranks first in this report. Total product gross profit: ${inrP(rows.reduce((s, r) => s + r.profit, 0))}.`
        : "No matching sale items recorded.";
    }
    answer.basis =
      "Revenue = sale item line totals. COGS = quantity × recorded acquisition landed unit cost. Gross profit = revenue − COGS; margin = profit ÷ revenue × 100. Best selling ranked by kg.";
    if (plan.intent === "product_compare")
      answer.basis += ` Compared with ${prevFrom} to ${prevTo} (equal-length previous period).`;
    const missing = sales.filter((s) => !db.items.some((i) => i.sale_id === s.id)).length;
    if (missing)
      answer.notes.push(
        `${missing} invoices have no sale items; product attribution is incomplete.`,
      );
    if (items.some((i) => Number(i.unit_cost) === 0))
      answer.notes.push(
        "Some sale items have zero recorded landed cost; profitability may be overstated.",
      );
  } else if (plan.intent === "below_cost") {
    const prices = latest(
      db.prices.filter(
        (p) =>
          !p.is_void &&
          p.effective_date <= to &&
          customerIds.has(p.customer_id) &&
          productIds.has(p.product_id),
      ),
      (p) => `${p.customer_id}|${p.product_id}`,
      (p) => p.effective_date,
    );
    let missing = 0;
    answer.columns = [
      "Customer",
      "Product",
      "Selling / kg",
      "Landed / kg",
      "Gap / kg",
      "Price date",
      "Cost date",
    ];
    for (const price of prices) {
      const cost = latest(
        costRows.filter((c) => c.product_id === price.product_id),
        (c) => c.product_id,
        (c) => c.effective_date,
      )[0];
      if (!cost) {
        missing++;
        continue;
      }
      if (Number(price.price) < Number(cost.landed_cost))
        answer.rows.push([
          cName(price.customer_id),
          pName(price.product_id),
          inrP(price.price),
          inrP(cost.landed_cost),
          inrP(Number(cost.landed_cost) - Number(price.price)),
          price.effective_date,
          cost.effective_date,
        ]);
    }
    answer.title = "Customer prices below landed cost";
    answer.summary = `${answer.rows.length} current customer-product prices are below recorded landed cost.`;
    answer.basis =
      "Compare latest customer selling price and latest landed cost effective on or before the as-of date. This is a current price comparison, not a realised invoice loss.";
    if (missing)
      answer.notes.push(
        `${missing} customer-product prices have no corresponding landed cost; excluded from the comparison.`,
      );
    if (!prices.length)
      answer.notes.push("No customer-specific selling prices recorded for this selection.");
  } else if (plan.intent === "price_history") {
    answer.title = "Historical landed and selling prices";
    answer.columns = ["Date", "Product", "Price type", "Customer", "Price / kg"];
    answer.rows = [
      ...costRows
        .filter((c) => c.effective_date >= from)
        .map((c) => [
          c.effective_date,
          pName(c.product_id),
          "Landed cost",
          "—",
          inrP(c.landed_cost),
        ]),
      ...db.prices
        .filter(
          (p) =>
            !p.is_void &&
            p.effective_date >= from &&
            p.effective_date <= to &&
            productIds.has(p.product_id) &&
            customerIds.has(p.customer_id),
        )
        .map((p) => [
          p.effective_date,
          pName(p.product_id),
          "Customer selling price",
          cName(p.customer_id),
          inrP(p.price),
        ]),
      ...items.map((i) => [
        sales.find((s) => s.id === i.sale_id)?.sale_date ?? "",
        pName(i.product_id),
        "Invoice selling price",
        cName(sales.find((s) => s.id === i.sale_id)?.customer_id ?? ""),
        inrP(i.unit_price),
      ]),
    ].sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? ""));
    answer.summary = `${answer.rows.length} recorded price observations in this period.`;
    answer.basis =
      "Dated, non-void landed-cost history, customer price history and actual invoice item selling prices. No competitor prices inferred.";
  } else if (plan.intent === "market_compare") {
    answer.title = "Commodity market price benchmark";
    answer.columns = [
      "Product",
      "Benchmark Source",
      "Market Rate / kg",
      "Our Landed Cost",
      "Spread (₹/kg)",
      "Market Observation Date",
    ];
    const latestMarket = latest(
      (db.market_prices || []).filter(
        (m) => !m.is_void && m.price_date <= to && productIds.has(m.product_id),
      ),
      (m) => `${m.product_id}|${m.source_name || "market"}`,
      (m) => m.price_date,
    );
    for (const m of latestMarket) {
      const cost = latest(
        costRows.filter((c) => c.product_id === m.product_id),
        (c) => c.product_id,
        (c) => c.effective_date,
      )[0];
      const costVal = cost ? Number(cost.landed_cost) : null;
      const spread = costVal !== null ? Number(m.price) - costVal : null;
      answer.rows.push([
        pName(m.product_id),
        m.source_name || "Market Benchmark",
        inrP(m.price),
        costVal !== null ? inrP(costVal) : "Not recorded",
        spread !== null ? inrP(spread) : "—",
        m.price_date,
      ]);
    }
    answer.summary = `${answer.rows.length} benchmark market rates tracked.`;
    answer.basis =
      "Latest market prices from market_prices compared against recorded landed acquisition cost. Positive spread indicates open market trading above internal acquisition cost.";
    if (!latestMarket.length) {
      answer.notes.push(
        "No competitor or market benchmark prices recorded for this period in market_prices.",
      );
    }
  } else if (plan.intent === "supplier_purchases") {
    answer.title = "Supplier procurement and purchase spend";
    answer.columns = [
      "Supplier",
      "Shipments",
      "Volume (kg)",
      "Total Spend",
      "Avg Cost / kg",
      "Avg Freight / kg",
    ];
    const purchases = (db.purchases || []).filter(
      (p) => p.purchase_date >= from && p.purchase_date <= to && productIds.has(p.product_id),
    );
    const suppMap = new Map<
      string,
      { count: number; kg: number; productSpend: number; freight: number; spend: number }
    >();
    for (const p of purchases) {
      const sId = p.supplier_id || "direct";
      const cur = suppMap.get(sId) || {
        count: 0,
        kg: 0,
        productSpend: 0,
        freight: 0,
        spend: 0,
      };
      const kg = Number(p.quantity_kg);
      const prodCost = kg * Number(p.unit_cost);
      const freightCost = kg * Number(p.freight_per_kg || 0);
      cur.count += 1;
      cur.kg += kg;
      cur.productSpend += prodCost;
      cur.freight += freightCost;
      cur.spend += prodCost + freightCost;
      suppMap.set(sId, cur);
    }
    const sName = (id: string) =>
      db.suppliers?.find((s) => s.id === id)?.name ??
      (id === "direct" ? "Direct / Unspecified" : "Supplier");
    const ranked = Array.from(suppMap.entries())
      .map(([id, stats]) => ({
        id,
        name: sName(id),
        ...stats,
        avgCost: stats.kg > 0 ? stats.spend / stats.kg : 0,
        avgFreight: stats.kg > 0 ? stats.freight / stats.kg : 0,
      }))
      .sort((a, b) => b.spend - a.spend);

    answer.rows = ranked.map((r) => [
      r.name,
      num(r.count),
      num(r.kg),
      inrP(r.spend),
      inrP(r.avgCost),
      inrP(r.avgFreight),
    ]);
    const totalSpend = ranked.reduce((s, r) => s + r.spend, 0);
    const totalKg = ranked.reduce((s, r) => s + r.kg, 0);
    answer.summary = `${ranked.length} suppliers active; total procurement spend: ${inrP(totalSpend)} across ${num(totalKg)} kg.`;
    answer.basis =
      "Inward purchases aggregated from purchases table. Total spend = (quantity × purchase unit cost) + (quantity × applicable freight per kg). Double counting avoided.";
    if (!purchases.length) {
      answer.notes.push("No inward supplier purchases recorded in the selected period.");
    }
  } else if (plan.intent === "expense_summary") {
    answer.title = "Operating expenses by category";
    answer.columns = ["Category", "Vouchers", "Total Amount", "Share of Overhead"];
    const expenses = (db.expenses || []).filter(
      (e) => e.expense_date >= from && e.expense_date <= to,
    );
    const catMap = new Map<string, { count: number; amount: number }>();
    for (const e of expenses) {
      const cat = e.category || "General";
      const cur = catMap.get(cat) || { count: 0, amount: 0 };
      cur.count += 1;
      cur.amount += Number(e.amount);
      catMap.set(cat, cur);
    }
    const totalExpense = Array.from(catMap.values()).reduce((s, c) => s + c.amount, 0);
    const ranked = Array.from(catMap.entries())
      .map(([cat, stats]) => ({
        category: cat,
        count: stats.count,
        amount: stats.amount,
        share: totalExpense > 0 ? (stats.amount / totalExpense) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    answer.rows = ranked.map((r) => [r.category, num(r.count), inrP(r.amount), pct(r.share)]);
    answer.summary = `Total operating overhead: ${inrP(totalExpense)} across ${num(expenses.length)} vouchers in ${ranked.length} categories.`;
    answer.basis =
      "Vouchers recorded in expenses table for the selected period. Excludes product acquisition cost (COGS).";
    if (!expenses.length) {
      answer.notes.push("No operational expense vouchers recorded in this period.");
    }
  } else if (plan.intent === "net_performance") {
    answer.title = "Business net performance & profitability";
    answer.columns = ["Metric", "Amount", "% of Revenue", "Operational Note"];
    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total_amount), 0);
    const totalCost = sales.reduce((sum, s) => sum + Number(s.total_cost), 0);
    const grossProf = grossProfit(totalRevenue, totalCost);
    const grossMarg = grossMargin(totalRevenue, totalCost);
    const expenses = (db.expenses || []).filter(
      (e) => e.expense_date >= from && e.expense_date <= to,
    );
    const totalExpense = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netProf = grossProf - totalExpense;
    const netMarg = totalRevenue > 0 ? (netProf / totalRevenue) * 100 : 0;

    answer.rows = [
      ["Gross Invoiced Revenue", inrP(totalRevenue), "100.0%", `${sales.length} non-void invoices`],
      [
        "Landed COGS",
        inrP(totalCost),
        pct(totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0),
        "Product acquisition cost",
      ],
      ["Gross Operating Profit", inrP(grossProf), pct(grossMarg), "Revenue − Landed COGS"],
      [
        "Operating Overhead",
        inrP(totalExpense),
        pct(totalRevenue > 0 ? (totalExpense / totalRevenue) * 100 : 0),
        `${expenses.length} expense vouchers recorded`,
      ],
      ["Net Operating Profit", inrP(netProf), pct(netMarg), "Gross profit − Operating overhead"],
    ];
    answer.summary = `Invoiced revenue: ${inrP(totalRevenue)}; Gross profit: ${inrP(grossProf)} (${pct(grossMarg)}); Net profit: ${inrP(netProf)} (${pct(netMarg)}).`;
    answer.basis =
      "Integrated performance: Gross profit = invoice revenue − landed COGS. Net profit = gross profit − recorded operating expenses.";
    if (!expenses.length) {
      answer.notes.push(
        "No operating expenses recorded for this period; net profit reflects gross profit only.",
      );
    }
  } else {
    answer.title =
      plan.intent === "exposure"
        ? "Estimated inventory price-drop exposure"
        : "Stock and acquisition value";
    const drop = plan.drop;
    answer.columns = [
      "Product",
      "Location",
      "Snapshot date",
      "Stock (kg)",
      "Acquisition / kg",
      "Acquisition value",
      ...(plan.intent === "exposure" ? ["Estimated exposure"] : []),
    ];
    answer.rows = inventory.map((i) => [
      pName(i.product_id),
      i.godown,
      i.snapshot_date,
      num(i.quantity_kg),
      inrP(i.avg_cost),
      inrP(Number(i.quantity_kg) * Number(i.avg_cost)),
      ...(plan.intent === "exposure"
        ? [
            drop === null
              ? "Drop not specified"
              : inrP(estimatedExposure(Number(i.quantity_kg), drop)),
          ]
        : []),
    ]);
    const value = inventory.reduce((s, i) => s + Number(i.quantity_kg) * Number(i.avg_cost), 0);
    answer.summary = `Recorded stock: ${num(inventory.reduce((s, i) => s + Number(i.quantity_kg), 0))} kg; acquisition value: ${inrP(value)}.`;
    if (plan.intent === "exposure" && drop !== null)
      answer.summary += ` At a ${inrP(drop)} / kg decline, estimated exposure is ${inrP(inventory.reduce((s, i) => s + estimatedExposure(Number(i.quantity_kg), drop), 0))}. This is not a realised loss.`;
    answer.basis =
      "Use one latest inventory snapshot per product and location on or before the as-of date. Acquisition value = quantity × snapshot average acquisition cost; not current market valuation.";
    if (plan.intent === "exposure" && drop === null)
      answer.notes.push(
        "Specify the estimated price decline in ₹ per kg to calculate exposure; no decline assumed.",
      );
    answer.notes.push(
      "Only recorded locations are shown; missing shop/godown snapshots are not assumed to have zero stock. Snapshot dates may differ.",
    );
    if (plan.intent === "exposure") {
      answer.notes.push(
        `Calculated as eligible stock quantity × ₹${(drop !== null ? drop : 2).toFixed(2)} per kg under the explicit assumption that on-hand physical quantities and other operating costs remain unchanged.`,
      );
    }
  }
  if (!answer.rows.length) {
    answer.status = "empty";
    answer.notes.push(
      "No matching records support a ranked result; this does not prove that unrecorded activity was zero.",
    );
  }
  if (answer.rows.length > 200) {
    answer.notes.push(
      `Showing first 200 of ${answer.rows.length} supporting rows; totals use all matching records.`,
    );
    answer.rows = answer.rows.slice(0, 200);
  }
  return answer;
}
