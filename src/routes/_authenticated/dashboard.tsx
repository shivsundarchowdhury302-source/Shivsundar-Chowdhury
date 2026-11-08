import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Overview — WholesaleIQ" }] }),
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate({ to: "/customers", replace: true });
  }, [navigate]);
  return <div className="p-8 text-sm text-muted-foreground">Redirecting to Customers…</div>;
}

const tip = { contentStyle: { borderRadius: 8, border: "1px solid var(--border)", fontSize: 12 } };

function Dashboard() {
  const [range, setRange] = useState<Range>(presetRange("30d"));
  const sales = useQuery(salesSinceQuery(range.from, range.to));
  const items = useQuery(saleItemsSinceQuery(range.from, range.to));
  const customers = useQuery(customerSummaryQuery());
  const products = useQuery(productsQuery());
  const costs = useQuery(costHistoryQuery());
  const market = useQuery(marketPricesQuery());
  const inv = useQuery(inventoryQuery());

  const m = useMemo(() => {
    if (
      !sales.data ||
      !customers.data ||
      !items.data ||
      !products.data ||
      !costs.data ||
      !market.data ||
      !inv.data
    )
      return null;
    const pName = new Map(products.data.map((p) => [p.id, p.name]));
    const cName = new Map(customers.data.map((c) => [c.id!, c.name!]));
    const totalSales = sales.data.reduce((a, s) => a + Number(s.total_amount), 0);
    const totalCost = sales.data.reduce((a, s) => a + Number(s.total_cost), 0);
    const active = new Set(sales.data.map((s) => s.customer_id)).size;

    const byDay = new Map<string, { date: string; sales: number; gp: number }>();
    for (const s of sales.data) {
      const r = byDay.get(s.sale_date) ?? { date: s.sale_date, sales: 0, gp: 0 };
      r.sales += Number(s.total_amount);
      r.gp += Number(s.total_amount) - Number(s.total_cost);
      byDay.set(s.sale_date, r);
    }
    const byCust = new Map<string, { sales: number; gp: number }>();
    for (const s of sales.data) {
      const r = byCust.get(s.customer_id) ?? { sales: 0, gp: 0 };
      r.sales += Number(s.total_amount);
      r.gp += Number(s.total_amount) - Number(s.total_cost);
      byCust.set(s.customer_id, r);
    }
    const custRows = [...byCust.entries()].map(([id, v]) => ({ name: cName.get(id) ?? "—", ...v }));
    const byProd = new Map<string, { rev: number; cost: number }>();
    for (const i of items.data) {
      const r = byProd.get(i.product_id) ?? { rev: 0, cost: 0 };
      r.rev += Number(i.line_total);
      r.cost += Number(i.quantity_kg) * Number(i.unit_cost);
      byProd.set(i.product_id, r);
    }
    const prodRows = [...byProd.entries()].map(([id, v]) => ({
      name: pName.get(id) ?? "—",
      gp: v.rev - v.cost,
      margin: marginPct(v.rev, v.cost),
    }));

    // margin trend: latest market vs cost now vs 4 weeks ago
    const sorted = (pid: string) =>
      costs.data
        .filter((c) => c.product_id === pid)
        .sort((a, b) => a.effective_date.localeCompare(b.effective_date));
    const mkt = market.data.filter((x) => x.source_type === "market");
    const mSorted = (pid: string) =>
      mkt
        .filter((c) => c.product_id === pid)
        .sort((a, b) => a.price_date.localeCompare(b.price_date));
    const declining = products.data
      .map((p) => {
        const c = sorted(p.id),
          mp = mSorted(p.id);
        if (c.length < 5 || mp.length < 5) return null;
        const now = marginPct(Number(mp.at(-1)!.price), Number(c.at(-1)!.landed_cost));
        const prev = marginPct(Number(mp.at(-5)!.price), Number(c.at(-5)!.landed_cost));
        return { name: p.name, now, change: now - prev };
      })
      .filter((x): x is NonNullable<typeof x> => !!x && x.change < 0)
      .sort((a, b) => a.change - b.change)
      .slice(0, 5);

    const recentMkt = products.data
      .map((p) => {
        const mp = mSorted(p.id);
        if (mp.length < 2) return null;
        const a = Number(mp.at(-2)!.price),
          b = Number(mp.at(-1)!.price);
        return { name: p.name, price: b, change: b - a };
      })
      .filter((x): x is NonNullable<typeof x> => !!x)
      .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
      .slice(0, 6);

    const latestMkt = latestBy(
      mkt,
      (x) => x.product_id,
      (x) => x.price_date,
    );
    let exposure = 0;
    for (const s of inv.data) {
      const mp = latestMkt.get(s.product_id);
      if (mp && Number(mp.price) < Number(s.avg_cost))
        exposure += (Number(s.avg_cost) - Number(mp.price)) * Number(s.quantity_kg);
    }

    return {
      totalSales,
      gp: totalSales - totalCost,
      active,
      outstanding: customers.data.reduce((a, c) => a + Math.max(0, Number(c.outstanding)), 0),
      overdue: customers.data.reduce((a, c) => a + Number(c.overdue), 0),
      overdueCount: customers.data.filter((c) => Number(c.overdue) > 0).length,
      trend: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
      topSales: [...custRows].sort((a, b) => b.sales - a.sales).slice(0, 6),
      topGp: [...custRows].sort((a, b) => b.gp - a.gp).slice(0, 6),
      topProd: [...prodRows].sort((a, b) => b.gp - a.gp).slice(0, 6),
      declining,
      recentMkt,
      exposure,
    };
  }, [sales.data, items.data, customers.data, products.data, costs.data, market.data, inv.data]);

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle="Executive summary of sales, profitability, credit and price exposure."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />
      <SampleBanner />
      {!m ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Total sales" value={inrCompact(m.totalSales)} hint="Selected period" />
            <Stat
              label="Est. gross profit"
              value={inrCompact(m.gp)}
              hint={`${pct(marginPct(m.totalSales, m.totalSales - m.gp))} margin`}
              tone="good"
            />
            <Stat
              label="Outstanding credit"
              value={inrCompact(m.outstanding)}
              hint="All customers, today"
            />
            <Stat
              label="Overdue balances"
              value={inrCompact(m.overdue)}
              hint={`${m.overdueCount} customers past terms`}
              tone="bad"
            />
            <Stat label="Active customers" value={String(m.active)} hint="Purchased in period" />
            <Stat
              label="Price-drop exposure"
              value={inrCompact(m.exposure)}
              hint="Stock cost above market"
              tone="warn"
            />
          </div>

          <Panel title="Sales & gross profit" subtitle="Daily totals for the selected period">
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={m.trend} margin={{ left: 0, right: 8 }}>
                  <defs>
                    <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(d) => d.slice(5)}
                    stroke="var(--muted-foreground)"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => inrCompact(v)}
                    stroke="var(--muted-foreground)"
                    width={70}
                  />
                  <Tooltip {...tip} formatter={(v) => inr(Number(v))} />
                  <Area
                    dataKey="sales"
                    name="Sales"
                    stroke="var(--chart-1)"
                    fill="url(#gS)"
                    strokeWidth={2}
                  />
                  <Area
                    dataKey="gp"
                    name="Gross profit"
                    stroke="var(--chart-2)"
                    fill="transparent"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <div className="grid gap-6 lg:grid-cols-2">
            <RankPanel
              title="Top customers by sales"
              rows={m.topSales.map((r) => ({ name: r.name, v: r.sales }))}
              color="var(--chart-1)"
            />
            <RankPanel
              title="Top customers by gross contribution"
              rows={m.topGp.map((r) => ({ name: r.name, v: r.gp }))}
              color="var(--chart-2)"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Panel title="Most profitable products" subtitle="Gross profit in period">
              <ul className="divide-y text-sm">
                {m.topProd.map((p) => (
                  <li key={p.name} className="flex justify-between py-2">
                    <span>{p.name}</span>
                    <span className="num">
                      {inrCompact(p.gp)}{" "}
                      <span className="text-xs text-muted-foreground">· {pct(p.margin)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel title="Declining margins" subtitle="Market price vs landed cost, last 4 weeks">
              {m.declining.length === 0 ? (
                <p className="text-sm text-muted-foreground">No products with falling margins.</p>
              ) : (
                <ul className="divide-y text-sm">
                  {m.declining.map((p) => (
                    <li key={p.name} className="flex justify-between py-2">
                      <span>{p.name}</span>
                      <span className="num text-destructive">
                        {p.change.toFixed(1)} pts{" "}
                        <span className="text-xs text-muted-foreground">→ {pct(p.now)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel
              title="Recent market price changes"
              subtitle="Week-on-week, per kg"
              action={
                <Link to="/pricing" className="text-xs text-success hover:underline">
                  Pricing →
                </Link>
              }
            >
              <ul className="divide-y text-sm">
                {m.recentMkt.map((p) => (
                  <li key={p.name} className="flex justify-between py-2">
                    <span>{p.name}</span>
                    <span className="num">
                      {inrP(p.price)}{" "}
                      <span className={p.change < 0 ? "text-destructive" : "text-success"}>
                        {p.change >= 0 ? "▲" : "▼"} {Math.abs(p.change).toFixed(2)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function RankPanel({
  title,
  rows,
  color,
}: {
  title: string;
  rows: { name: string; v: number }[];
  color: string;
}) {
  return (
    <Panel title={title}>
      <div className="h-60">
        <ResponsiveContainer>
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={150}
              tick={{ fontSize: 11 }}
              stroke="var(--muted-foreground)"
            />
            <Tooltip {...tip} formatter={(v) => inr(Number(v))} cursor={{ fill: "var(--muted)" }} />
            <Bar dataKey="v" name="Value" fill={color} radius={[0, 4, 4, 0]} barSize={16} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
