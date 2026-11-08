import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel, SampleBanner, Loading } from "@/components/app/ui-bits";
import { DateRangeFilter, presetRange, type Range } from "@/components/app/date-range";
import { productsQuery, saleItemsSinceQuery } from "@/lib/queries";
import { inr, inrCompact, marginPct, num, pct } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/product-analytics")({
  head: () => ({
    meta: [
      { title: "Product Analytics — WholesaleIQ" },
      { name: "description", content: "Revenue, volume and gross margin by product." },
    ],
  }),
  component: () => (
    <Guard path="/product-analytics">
      <PA />
    </Guard>
  ),
});

function PA() {
  const [range, setRange] = useState<Range>(presetRange("90d"));
  const products = useQuery(productsQuery());
  const items = useQuery(saleItemsSinceQuery(range.from, range.to));
  const rows =
    products.data && items.data
      ? products.data
          .map((p) => {
            const it = items.data.filter((i) => i.product_id === p.id);
            const rev = it.reduce((a, i) => a + Number(i.line_total), 0);
            const cost = it.reduce((a, i) => a + Number(i.quantity_kg) * Number(i.unit_cost), 0);
            return {
              name: p.name,
              category: p.category,
              kg: it.reduce((a, i) => a + Number(i.quantity_kg), 0),
              rev,
              gp: rev - cost,
              margin: marginPct(rev, cost),
            };
          })
          .sort((a, b) => b.gp - a.gp)
      : null;
  return (
    <>
      <PageHeader
        title="Product Analytics"
        subtitle="Which products generate the highest gross margins."
        actions={<DateRangeFilter value={range} onChange={setRange} />}
      />
      <SampleBanner />
      {!rows ? (
        <Loading />
      ) : (
        <div className="space-y-6">
          <Panel title="Gross margin % by product">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={[...rows].sort((a, b) => b.margin - a.margin)}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} width={40} />
                  <Tooltip formatter={(v) => pct(Number(v))} />
                  <Bar dataKey="margin" name="Margin" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Panel title="Product performance">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Volume (kg)</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Gross profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm">{r.category}</TableCell>
                      <TableCell className="num text-right">{num(r.kg)}</TableCell>
                      <TableCell className="num text-right">{inrCompact(r.rev)}</TableCell>
                      <TableCell className="num text-right">{inr(r.gp)}</TableCell>
                      <TableCell className="num text-right">{pct(r.margin)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}
