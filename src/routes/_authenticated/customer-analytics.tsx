import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel, SampleBanner, Loading } from "@/components/app/ui-bits";
import { customerSummaryQuery, salesSinceQuery } from "@/lib/queries";
import { inr, inrCompact, pct } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/customer-analytics")({
  head: () => ({
    meta: [
      { title: "Customer Analytics — WholesaleIQ" },
      {
        name: "description",
        content: "Purchase trends, category mix and customers with reduced buying.",
      },
    ],
  }),
  component: () => (
    <Guard path="/customer-analytics">
      <CA />
    </Guard>
  ),
});

const f = (d: Date) => format(d, "yyyy-MM-dd");
const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--muted-foreground)",
  "var(--accent-foreground)",
];

function CA() {
  const sales = useQuery(salesSinceQuery(f(subDays(new Date(), 59)), f(new Date())));
  const cust = useQuery(customerSummaryQuery());
  if (!sales.data || !cust.data) return <Loading />;
  const cut = f(subDays(new Date(), 29));
  const rows = cust.data
    .map((c) => {
      const s = sales.data.filter((x) => x.customer_id === c.id);
      const recent = s
        .filter((x) => x.sale_date >= cut)
        .reduce((a, x) => a + Number(x.total_amount), 0);
      const prior = s
        .filter((x) => x.sale_date < cut)
        .reduce((a, x) => a + Number(x.total_amount), 0);
      return {
        id: c.id,
        name: c.name,
        category: c.category,
        recent,
        prior,
        change: prior ? ((recent - prior) / prior) * 100 : 0,
      };
    })
    .sort((a, b) => a.change - b.change);
  const cats = new Map<string, number>();
  for (const c of cust.data)
    cats.set(c.category!, (cats.get(c.category!) ?? 0) + Number(c.total_sales));
  const catRows = [...cats.entries()].map(([name, value]) => ({ name, value }));
  return (
    <>
      <PageHeader
        title="Customer Analytics"
        subtitle="Last 30 days compared with the 30 days before."
      />
      <SampleBanner />
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Purchase change by customer"
          subtitle="Sorted by largest decline first"
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Prior 30d</TableHead>
                  <TableHead className="text-right">Last 30d</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.name}
                      <div className="text-xs text-muted-foreground">{r.category}</div>
                    </TableCell>
                    <TableCell className="num text-right">{inr(r.prior)}</TableCell>
                    <TableCell className="num text-right">{inr(r.recent)}</TableCell>
                    <TableCell
                      className={`num text-right ${r.change < 0 ? "text-destructive" : "text-success"}`}
                    >
                      {r.change > 0 ? "+" : ""}
                      {pct(r.change)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
        <Panel title="Sales by customer category" subtitle="Last 90 days">
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={catRows}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                >
                  {catRows.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]!} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => inr(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 space-y-1 text-sm">
            {catRows.map((c, i) => (
              <li key={c.name} className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  {c.name}
                </span>
                <span className="num">{inrCompact(c.value)}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
