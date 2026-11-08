import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel, SampleBanner, Loading } from "@/components/app/ui-bits";
import { customerPricesQuery, latestBy, marketPricesQuery, productsQuery } from "@/lib/queries";
import { inrP } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/competitors")({
  head: () => ({
    meta: [
      { title: "Competitor Analysis — WholesaleIQ" },
      {
        name: "description",
        content: "Competitor quotations compared with internal selling prices.",
      },
    ],
  }),
  component: () => (
    <Guard path="/competitors">
      <Competitors />
    </Guard>
  ),
});

function Competitors() {
  const products = useQuery(productsQuery());
  const market = useQuery(marketPricesQuery());
  const cp = useQuery(customerPricesQuery());
  if (!products.data || !market.data || !cp.data) return <Loading />;
  const comp = market.data.filter((m) => m.source_type === "competitor");
  const names = [...new Set(comp.map((c) => c.source_name ?? "Competitor"))];
  const latest = latestBy(
    comp,
    (c) => `${c.product_id}|${c.source_name}`,
    (c) => c.price_date,
  );
  const lastCust = latestBy(
    cp.data,
    (p) => `${p.customer_id}|${p.product_id}`,
    (p) => p.effective_date,
  );
  const rows = products.data.map((p) => {
    const ours = [...lastCust.values()]
      .filter((x) => x.product_id === p.id)
      .map((x) => Number(x.price));
    const r: Record<string, number | string> = {
      name: p.name,
      ours: ours.reduce((a, b) => a + b, 0) / Math.max(1, ours.length),
    };
    names.forEach((n) => (r[n] = Number(latest.get(`${p.id}|${n}`)?.price ?? 0)));
    return r;
  });
  const colors = ["var(--chart-3)", "var(--chart-5)", "var(--chart-4)"];
  return (
    <>
      <PageHeader
        title="Competitor Analysis"
        subtitle="Latest competitor quotations vs our average negotiated price, per kg."
      />
      <SampleBanner />
      <div className="space-y-6">
        <Panel title="Our average price vs competitors">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={rows}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis tick={{ fontSize: 11 }} width={45} />
                <Tooltip formatter={(v) => inrP(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="ours" name="Our avg" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
                {names.map((n, i) => (
                  <Bar key={n} dataKey={n} fill={colors[i % 3]} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Price gap">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Our avg</TableHead>
                  {names.map((n) => (
                    <TableHead key={n} className="text-right">
                      {n}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={String(r["name"])}>
                    <TableCell className="font-medium">{r["name"]}</TableCell>
                    <TableCell className="num text-right">{inrP(Number(r["ours"]))}</TableCell>
                    {names.map((n) => {
                      const gap = Number(r["ours"]) - Number(r[n]);
                      return (
                        <TableCell key={n} className="num text-right">
                          {inrP(Number(r[n]))}{" "}
                          <span
                            className={`text-xs ${gap > 0 ? "text-destructive" : "text-success"}`}
                          >
                            ({gap > 0 ? "+" : ""}
                            {gap.toFixed(2)})
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Red = we are priced above that competitor.
          </p>
        </Panel>
      </div>
    </>
  );
}
