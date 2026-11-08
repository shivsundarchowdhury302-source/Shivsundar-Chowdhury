import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel, SampleBanner, Stat, Loading } from "@/components/app/ui-bits";
import { inventoryQuery, latestBy, marketPricesQuery, productsQuery } from "@/lib/queries";
import { inr, inrCompact, inrP, num, priceDropExposure } from "@/lib/format";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory Valuation — WholesaleIQ" },
      {
        name: "description",
        content:
          "Stock valuation at cost and market across shop and godowns, with price-drop exposure.",
      },
    ],
  }),
  component: () => (
    <Guard path="/inventory">
      <Inventory />
    </Guard>
  ),
});

function Inventory() {
  const inv = useQuery(inventoryQuery());
  const products = useQuery(productsQuery());
  const market = useQuery(marketPricesQuery());
  const [drop, setDrop] = useState(1);

  const d = useMemo(() => {
    if (!inv.data || !products.data || !market.data) return null;
    const mkt = latestBy(
      market.data.filter((m) => m.source_type === "market"),
      (m) => m.product_id,
      (m) => m.price_date,
    );
    const rows = products.data.map((p) => {
      const s = inv.data.filter((x) => x.product_id === p.id);
      const qty = s.reduce((a, x) => a + Number(x.quantity_kg), 0);
      const atCost = s.reduce((a, x) => a + Number(x.quantity_kg) * Number(x.avg_cost), 0);
      const mp = Number(mkt.get(p.id)?.price ?? 0);
      return {
        name: p.name,
        qty,
        avgCost: atCost / Math.max(1, qty),
        atCost,
        atMarket: qty * mp,
        mp,
      };
    });
    const godowns = [...new Set(inv.data.map((x) => x.godown))].map((g) => ({
      g,
      value: inv.data
        .filter((x) => x.godown === g)
        .reduce((a, x) => a + Number(x.quantity_kg) * Number(x.avg_cost), 0),
    }));
    return { rows, godowns };
  }, [inv.data, products.data, market.data]);

  if (!d) return <Loading />;
  const cost = d.rows.reduce((a, r) => a + r.atCost, 0);
  const mv = d.rows.reduce((a, r) => a + r.atMarket, 0);
  const qty = d.rows.reduce((a, r) => a + r.qty, 0);
  return (
    <>
      <PageHeader
        title="Inventory Valuation"
        subtitle="Stock across the main shop and six godowns, valued at average cost and at today's market reference."
      />
      <SampleBanner />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Stock on hand" value={`${num(qty / 1000)} t`} />
        <Stat label="Value at cost" value={inrCompact(cost)} />
        <Stat
          label="Value at market"
          value={inrCompact(mv)}
          tone={mv < cost ? "bad" : "good"}
          hint={`${mv < cost ? "−" : "+"}${inrCompact(Math.abs(mv - cost))} vs cost`}
        />
        <Stat
          label={`Exposure if −₹${drop}/kg`}
          value={inrCompact(priceDropExposure(qty, drop))}
          tone="warn"
        />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="By product">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Qty (kg)</TableHead>
                  <TableHead className="text-right">Avg cost</TableHead>
                  <TableHead className="text-right">Market</TableHead>
                  <TableHead className="text-right">At cost</TableHead>
                  <TableHead className="text-right">Gain / loss</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.rows.map((r) => (
                  <TableRow key={r.name}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="num text-right">{num(r.qty)}</TableCell>
                    <TableCell className="num text-right">{inrP(r.avgCost)}</TableCell>
                    <TableCell className="num text-right">{inrP(r.mp)}</TableCell>
                    <TableCell className="num text-right">{inr(r.atCost)}</TableCell>
                    <TableCell
                      className={`num text-right ${r.atMarket < r.atCost ? "text-destructive" : "text-success"}`}
                    >
                      {inr(r.atMarket - r.atCost)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
        <div className="space-y-6">
          <Panel title="Scenario" subtitle="Uniform market drop across all stock">
            <div className="num text-2xl font-semibold">−{inrP(drop)} / kg</div>
            <Slider
              className="my-4"
              min={0}
              max={5}
              step={0.25}
              value={[drop]}
              onValueChange={([v]) => setDrop(v ?? 0)}
            />
            <div className="text-sm">
              Valuation loss:{" "}
              <span className="num font-semibold text-destructive">
                {inr(priceDropExposure(qty, drop))}
              </span>
            </div>
          </Panel>
          <Panel title="By location">
            <ul className="divide-y text-sm">
              {d.godowns.map((g) => (
                <li key={g.g} className="flex justify-between py-2">
                  <span>{g.g}</span>
                  <span className="num">{inrCompact(g.value)}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
