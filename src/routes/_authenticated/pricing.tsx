import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Calculator,
  Truck,
  Receipt,
  DollarSign,
  Percent,
  Layers,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel, SampleBanner, Loading } from "@/components/app/ui-bits";
import {
  costHistoryQuery,
  customerPricesQuery,
  inventoryQuery,
  latestBy,
  marketPricesQuery,
  productsQuery,
  purchasesQuery,
} from "@/lib/queries";
import { inr, inrP, marginPct, pct, priceDropExposure } from "@/lib/format";
import { grossProfitPerKg, grossMargin, calculateLandedCost } from "@/lib/financial";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing Intelligence — WholesaleIQ" },
      {
        name: "description",
        content:
          "Calculate landed cost, unit gross profit, and margin from base unit cost, inbound freight, and tax parameters.",
      },
    ],
  }),
  component: () => (
    <Guard path="/pricing">
      <Pricing />
    </Guard>
  ),
});

interface CostConfig {
  unitCost: number;
  freightPerKg: number;
  taxPct: number;
  taxPerKg: number;
}

function Pricing() {
  const products = useQuery(productsQuery());
  const costs = useQuery(costHistoryQuery());
  const market = useQuery(marketPricesQuery());
  const cprices = useQuery(customerPricesQuery());
  const inv = useQuery(inventoryQuery());
  const purchases = useQuery(purchasesQuery());

  const [selectedPid, setSelectedPid] = useState<string>("");
  const [marketDrop, setMarketDrop] = useState(2);

  // Global default freight and tax parameters
  const [defaultFreight, setDefaultFreight] = useState<number>(1.5);
  const [defaultTaxRate, setDefaultTaxRate] = useState<number>(5);

  // Per-product custom cost configurations (unit cost, freight, tax)
  const [customConfigs, setCustomConfigs] = useState<Record<string, Partial<CostConfig>>>({});

  // Calculator standalone tool state
  const [calcUnitCost, setCalcUnitCost] = useState<number>(40);
  const [calcFreight, setCalcFreight] = useState<number>(1.5);
  const [calcTaxRate, setCalcTaxRate] = useState<number>(5);
  const [calcSellingPrice, setCalcSellingPrice] = useState<number>(48);
  const [targetMargin, setTargetMargin] = useState<number>(8);

  // Process data with explicit landed cost = unit cost + freight + tax
  const data = useMemo(() => {
    if (!products.data || !costs.data || !market.data || !cprices.data || !inv.data) return null;

    const lastCost = latestBy(
      costs.data,
      (c) => c.product_id,
      (c) => c.effective_date,
    );
    const lastPurch = latestBy(
      purchases.data ?? [],
      (p) => p.product_id,
      (p) => p.purchase_date,
    );

    const mkt = market.data.filter((m) => m.source_type === "market");
    const comp = market.data.filter((m) => m.source_type === "competitor");
    const lastMkt = latestBy(
      mkt,
      (m) => m.product_id,
      (m) => m.price_date,
    );
    const lastCust = latestBy(
      cprices.data,
      (p) => `${p.customer_id}|${p.product_id}`,
      (p) => p.effective_date,
    );
    const latestCompDate = new Map<string, string>();
    for (const c of comp) {
      if ((latestCompDate.get(c.product_id) ?? "") < c.price_date) {
        latestCompDate.set(c.product_id, c.price_date);
      }
    }

    const rows = products.data.map((p) => {
      const historicalLanded = Number(lastCost.get(p.id)?.landed_cost ?? 0);
      const purch = lastPurch.get(p.id);

      // Determine Base Unit Cost
      // If purchase record exists, use its unit_cost; otherwise estimate base = landed - freight - tax
      const rawUnitCost = purch
        ? Number(purch.unit_cost)
        : Math.max(
            0,
            historicalLanded > 0
              ? (historicalLanded - defaultFreight) / (1 + defaultTaxRate / 100)
              : 0,
          );

      // Determine Inbound Freight
      const rawFreight = purch ? Number(purch.freight_per_kg) : defaultFreight;

      // Determine Tax Rate
      const rawTaxRate = defaultTaxRate;

      // Check if user has specific overrides for this product
      const cfg = customConfigs[p.id];
      const unitCost = cfg?.unitCost !== undefined ? cfg.unitCost : rawUnitCost;
      const freightPerKg = cfg?.freightPerKg !== undefined ? cfg.freightPerKg : rawFreight;
      const taxPct = cfg?.taxPct !== undefined ? cfg.taxPct : rawTaxRate;
      const taxPerKg = cfg?.taxPerKg !== undefined ? cfg.taxPerKg : 0;

      // Accurate landed cost calculation: unit cost + freight + tax
      const calculatedCost = calculateLandedCost(unitCost, freightPerKg, taxPct, taxPerKg);
      const taxAmount = (unitCost * taxPct) / 100 + taxPerKg;

      const custPrices = [...lastCust.values()]
        .filter((x) => x.product_id === p.id)
        .map((x) => Number(x.price));
      const avgPrice =
        custPrices.length > 0 ? custPrices.reduce((a, b) => a + b, 0) / custPrices.length : 0;
      const compNow = comp
        .filter((c) => c.product_id === p.id && c.price_date === latestCompDate.get(p.id))
        .map((c) => Number(c.price));
      const stock = inv.data
        .filter((s) => s.product_id === p.id)
        .reduce((a, s) => a + Number(s.quantity_kg), 0);

      // Unit gross profit and margin percentage
      const profit = grossProfitPerKg(avgPrice, calculatedCost);
      const margin = grossMargin(avgPrice, calculatedCost);

      return {
        id: p.id,
        name: p.name,
        unitCost,
        freightPerKg,
        taxPct,
        taxAmount,
        cost: calculatedCost,
        market: Number(lastMkt.get(p.id)?.price ?? 0),
        avg: avgPrice,
        min: custPrices.length ? Math.min(...custPrices) : 0,
        max: custPrices.length ? Math.max(...custPrices) : 0,
        compMin: compNow.length ? Math.min(...compNow) : null,
        profit,
        margin,
        stock,
        isCustom: !!cfg,
      };
    });

    const costLookup = new Map(rows.map((r) => [r.id, r.cost]));

    const below = [...lastCust.values()]
      .map((x) => {
        const cost =
          costLookup.get(x.product_id) ?? Number(lastCost.get(x.product_id)?.landed_cost ?? 0);
        const price = Number(x.price);
        const loss = cost - price;
        const lossMargin = price > 0 ? (loss / price) * 100 : 0;
        return {
          customer: x.customers?.name,
          product: x.products?.name,
          price,
          cost,
          loss,
          lossMargin,
        };
      })
      .filter((x) => x.price < x.cost)
      .sort((a, b) => b.loss - a.loss);

    return { rows, below };
  }, [
    products.data,
    costs.data,
    market.data,
    cprices.data,
    inv.data,
    purchases.data,
    defaultFreight,
    defaultTaxRate,
    customConfigs,
  ]);

  const activePid = selectedPid || products.data?.[0]?.id || "";
  const selectedProduct = data?.rows.find((r) => r.id === activePid);

  // Sync selected product into the Landed Cost Calculator when selection changes
  function loadProductIntoCalc(r: (typeof data & object)["rows"][number]) {
    setSelectedPid(r.id);
    setCalcUnitCost(Number(r.unitCost.toFixed(2)));
    setCalcFreight(Number(r.freightPerKg.toFixed(2)));
    setCalcTaxRate(Number(r.taxPct.toFixed(1)));
    setCalcSellingPrice(Number((r.avg || r.cost * 1.08).toFixed(2)));
  }

  // Standalone calculator real-time metrics
  const calcLandedCost = calculateLandedCost(calcUnitCost, calcFreight, calcTaxRate, 0);
  const calcTaxAmount = (calcUnitCost * calcTaxRate) / 100;
  const calcGrossProfit = grossProfitPerKg(calcSellingPrice, calcLandedCost);
  const calcGrossMargin = grossMargin(calcSellingPrice, calcLandedCost);
  const requiredSellingPrice =
    targetMargin < 100 ? calcLandedCost / (1 - targetMargin / 100) : calcLandedCost;

  // Trend chart data
  const trend = useMemo(() => {
    if (!costs.data || !market.data) return [];
    const m = new Map<string, Record<string, number | string>>();
    for (const c of costs.data.filter((c) => c.product_id === activePid)) {
      m.set(c.effective_date, {
        ...(m.get(c.effective_date) ?? { date: c.effective_date }),
        cost: Number(c.landed_cost),
      });
    }
    for (const x of market.data.filter(
      (x) => x.product_id === activePid && x.source_type === "market",
    )) {
      m.set(x.price_date, {
        ...(m.get(x.price_date) ?? { date: x.price_date }),
        market: Number(x.price),
      });
    }
    return [...m.values()].sort((a, b) => String(a["date"]).localeCompare(String(b["date"])));
  }, [costs.data, market.data, activePid]);

  if (!data) return <Loading />;

  const exposure = selectedProduct ? priceDropExposure(selectedProduct.stock, marketDrop) : 0;
  const simAvg = selectedProduct ? Math.max(0, selectedProduct.avg - marketDrop) : 0;
  const simProfit = selectedProduct ? grossProfitPerKg(simAvg, selectedProduct.cost) : 0;
  const simMargin = selectedProduct ? grossMargin(simAvg, selectedProduct.cost) : 0;

  function resetAllCustomCosts() {
    setCustomConfigs({});
    toast.success("Cost parameters reset to defaults.");
  }

  return (
    <>
      <PageHeader
        title="Pricing Intelligence"
        subtitle="Calculate accurate landed costs, unit gross profits, and margins from base unit cost, inbound freight, and tax parameters."
      />
      <SampleBanner />

      <div className="space-y-6">
        {/* Interactive Landed Cost Calculator Card */}
        <Panel
          title="Landed Cost & Margin Calculator"
          subtitle="Formulate pricing using Base Unit Cost + Inbound Freight + Tax to find Gross Profit and Gross Margin."
          action={
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Quick load product:</span>
              <Select
                value={activePid}
                onValueChange={(id) => {
                  const target = data.rows.find((r) => r.id === id);
                  if (target) loadProductIntoCalc(target);
                }}
              >
                <SelectTrigger className="h-8 w-48 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {data.rows.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          }
        >
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Input Parameters */}
            <div className="space-y-4 lg:col-span-7">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label
                    htmlFor="calc-unit"
                    className="text-xs flex items-center gap-1 font-medium"
                  >
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> Unit Cost (₹/kg)
                  </Label>
                  <Input
                    id="calc-unit"
                    type="number"
                    step={0.1}
                    min={0}
                    value={calcUnitCost}
                    onChange={(e) => setCalcUnitCost(Number(e.target.value) || 0)}
                  />
                  <span className="text-[11px] text-muted-foreground">Supplier invoice cost</span>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="calc-freight"
                    className="text-xs flex items-center gap-1 font-medium"
                  >
                    <Truck className="h-3.5 w-3.5 text-muted-foreground" /> Freight (₹/kg)
                  </Label>
                  <Input
                    id="calc-freight"
                    type="number"
                    step={0.1}
                    min={0}
                    value={calcFreight}
                    onChange={(e) => setCalcFreight(Number(e.target.value) || 0)}
                  />
                  <span className="text-[11px] text-muted-foreground">Inbound logistics</span>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="calc-tax" className="text-xs flex items-center gap-1 font-medium">
                    <Receipt className="h-3.5 w-3.5 text-muted-foreground" /> Tax / GST Rate (%)
                  </Label>
                  <div className="flex gap-1">
                    <Input
                      id="calc-tax"
                      type="number"
                      step={0.5}
                      min={0}
                      max={28}
                      value={calcTaxRate}
                      onChange={(e) => setCalcTaxRate(Number(e.target.value) || 0)}
                    />
                  </div>
                  <div className="flex gap-1 mt-1">
                    {[0, 5, 12].map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setCalcTaxRate(r)}
                        className={`rounded px-1.5 py-0.5 text-[10px] font-mono border ${
                          calcTaxRate === r
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted hover:bg-accent"
                        }`}
                      >
                        {r}%
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label
                    htmlFor="calc-sell"
                    className="text-xs flex items-center gap-1 font-medium"
                  >
                    Selling Price (₹/kg)
                  </Label>
                  <Input
                    id="calc-sell"
                    type="number"
                    step={0.25}
                    min={0}
                    value={calcSellingPrice}
                    onChange={(e) => setCalcSellingPrice(Number(e.target.value) || 0)}
                  />
                  <span className="text-[11px] text-muted-foreground">
                    Proposed wholesale quote
                  </span>
                </div>

                <div className="space-y-1.5">
                  <Label
                    htmlFor="calc-target"
                    className="text-xs flex items-center gap-1 font-medium"
                  >
                    Target Margin (%)
                  </Label>
                  <Input
                    id="calc-target"
                    type="number"
                    step={0.5}
                    min={1}
                    max={50}
                    value={targetMargin}
                    onChange={(e) => setTargetMargin(Number(e.target.value) || 0)}
                  />
                  <span className="text-[11px] text-muted-foreground">Desired margin</span>
                </div>
              </div>

              {/* Formula Documentation Snippet */}
              <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
                <div className="font-medium text-foreground">Mathematical Formulas:</div>
                <div>
                  • <strong>Landed Cost</strong> = Unit Cost + Freight + (Unit Cost × Tax Rate)
                </div>
                <div>
                  • <strong>Gross Profit</strong> = Selling Price − Landed Cost
                </div>
                <div>
                  • <strong>Gross Margin %</strong> = (Gross Profit ÷ Selling Price) × 100
                </div>
              </div>
            </div>

            {/* Real-time Calculated Outputs */}
            <div className="flex flex-col justify-between rounded-xl border bg-card p-4 lg:col-span-5 shadow-xs">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Calculation Results
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">Base Unit Cost</span>
                    <span className="num text-sm font-medium">{inrP(calcUnitCost)} / kg</span>
                  </div>

                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">Inbound Freight</span>
                    <span className="num text-sm font-medium">+{inrP(calcFreight)} / kg</span>
                  </div>

                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">
                      Taxes & Cess ({calcTaxRate}%)
                    </span>
                    <span className="num text-sm font-medium">+{inrP(calcTaxAmount)} / kg</span>
                  </div>

                  <div className="flex items-center justify-between border-b pb-2 bg-muted/30 p-2 rounded">
                    <span className="text-xs font-semibold text-foreground">Total Landed Cost</span>
                    <span className="num text-base font-bold text-foreground">
                      {inrP(calcLandedCost)} / kg
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">Unit Gross Profit</span>
                    <span
                      className={`num text-base font-bold ${
                        calcGrossProfit >= 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-destructive"
                      }`}
                    >
                      {calcGrossProfit >= 0 ? `+${inrP(calcGrossProfit)}` : inrP(calcGrossProfit)} /
                      kg
                    </span>
                  </div>

                  <div className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs text-muted-foreground">Gross Margin %</span>
                    <span
                      className={`num text-base font-bold ${
                        calcGrossMargin < 3
                          ? "text-destructive"
                          : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {pct(calcGrossMargin)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-2.5 text-xs">
                <div className="font-semibold text-primary">Required Selling Price:</div>
                <div className="flex items-center justify-between mt-1">
                  <span>To achieve {targetMargin}% margin:</span>
                  <span className="num font-bold text-sm text-primary">
                    {inrP(requiredSellingPrice)} / kg
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* Product Price Matrix with Cost Elements */}
        <Panel
          title="Product Cost & Price Matrix"
          subtitle="Catalogue-wide visibility into Unit Cost, Freight, Tax, Landed Cost, Gross Profit, and Margins"
          action={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Default Freight:</span>
                <Input
                  className="h-7 w-16 text-xs px-2"
                  type="number"
                  step={0.25}
                  value={defaultFreight}
                  onChange={(e) => setDefaultFreight(Number(e.target.value) || 0)}
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span>Default Tax:</span>
                <Input
                  className="h-7 w-14 text-xs px-2"
                  type="number"
                  step={1}
                  value={defaultTaxRate}
                  onChange={(e) => setDefaultTaxRate(Number(e.target.value) || 0)}
                />
                <span>%</span>
              </div>

              {Object.keys(customConfigs).length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={resetAllCustomCosts}
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Reset
                </Button>
              )}
            </div>
          }
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Freight / kg</TableHead>
                  <TableHead className="text-right">Tax ({defaultTaxRate}%)</TableHead>
                  <TableHead className="text-right font-semibold">Landed Cost</TableHead>
                  <TableHead className="text-right">Market Ref.</TableHead>
                  <TableHead className="text-right">Selling Price</TableHead>
                  <TableHead className="text-right font-semibold">Gross Profit / kg</TableHead>
                  <TableHead className="text-right font-semibold">Gross Margin</TableHead>
                  <TableHead className="text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer"
                    onClick={() => loadProductIntoCalc(r)}
                    data-state={r.id === activePid ? "selected" : undefined}
                  >
                    <TableCell className="font-medium">
                      <div>{r.name}</div>
                      {r.isCustom && (
                        <span className="text-[10px] text-primary font-medium">
                          Custom cost override
                        </span>
                      )}
                    </TableCell>

                    <TableCell className="num text-right text-muted-foreground">
                      {inrP(r.unitCost)}
                    </TableCell>

                    <TableCell className="num text-right text-muted-foreground">
                      +{inrP(r.freightPerKg)}
                    </TableCell>

                    <TableCell className="num text-right text-muted-foreground">
                      +{inrP(r.taxAmount)}
                    </TableCell>

                    <TableCell className="num text-right font-bold text-foreground">
                      {inrP(r.cost)}
                    </TableCell>

                    <TableCell className="num text-right text-muted-foreground">
                      {inrP(r.market)}
                    </TableCell>

                    <TableCell className="num text-right font-semibold">{inrP(r.avg)}</TableCell>

                    <TableCell
                      className={`num text-right font-semibold ${
                        r.profit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {r.profit >= 0 ? `+${inrP(r.profit)}` : inrP(r.profit)}
                    </TableCell>

                    <TableCell
                      className={`num text-right font-bold ${
                        r.margin < 3 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {pct(r.margin)}
                    </TableCell>

                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs px-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          loadProductIntoCalc(r);
                        }}
                      >
                        <Calculator className="h-3 w-3 mr-1" /> Test
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>

        {/* Analytical Trends & Price Drop Simulator */}
        <div className="grid gap-6 lg:grid-cols-3">
          <Panel
            className="lg:col-span-2"
            title="Cost vs Market Reference Trend"
            subtitle={
              selectedProduct
                ? `Tracking historical landed cost vs market for ${selectedProduct.name}`
                : ""
            }
          >
            <div className="h-64">
              <ResponsiveContainer>
                <LineChart data={trend}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} domain={["auto", "auto"]} width={50} />
                  <Tooltip formatter={(v) => inrP(Number(v))} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    dataKey="cost"
                    name="Landed cost"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    dataKey="market"
                    name="Market reference"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Market Price-Drop Simulator" subtitle={selectedProduct?.name ?? ""}>
            <div className="text-sm text-muted-foreground">If market selling price drops by:</div>
            <div className="num mt-1 text-3xl font-semibold">
              {inrP(marketDrop)}
              <span className="text-sm font-normal text-muted-foreground"> / kg</span>
            </div>
            <Slider
              className="my-5"
              min={0}
              max={10}
              step={0.5}
              value={[marketDrop]}
              onValueChange={([v]) => setMarketDrop(v ?? 0)}
            />
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Stock on hand</dt>
                <dd className="num font-medium">
                  {selectedProduct?.stock.toLocaleString("en-IN")} kg
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Inventory exposure loss</dt>
                <dd className="num font-semibold text-destructive">{inr(exposure)}</dd>
              </div>
              <div className="flex justify-between border-t pt-2">
                <dt className="text-muted-foreground">New Gross Profit / kg</dt>
                <dd
                  className={`num font-semibold ${
                    simProfit < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {selectedProduct
                    ? simProfit >= 0
                      ? `+${inrP(simProfit)}`
                      : inrP(simProfit)
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">New Gross Margin</dt>
                <dd
                  className={`num font-semibold ${
                    simMargin < 3 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {selectedProduct ? pct(simMargin) : "—"}
                </dd>
              </div>
            </dl>
          </Panel>
        </div>

        {/* Below Landed Cost Alerts */}
        <Panel
          title="Customer Accounts Priced Below Landed Cost"
          subtitle="Alert: Customer negotiated prices falling below current acquisition landed cost"
        >
          {data.below.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              All active customer prices are currently priced at or above landed cost.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Selling Price</TableHead>
                    <TableHead className="text-right">Landed Cost</TableHead>
                    <TableHead className="text-right">Loss / kg</TableHead>
                    <TableHead className="text-right">Negative Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.below.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                        {b.customer}
                      </TableCell>
                      <TableCell>{b.product}</TableCell>
                      <TableCell className="num text-right font-medium">{inrP(b.price)}</TableCell>
                      <TableCell className="num text-right text-muted-foreground">
                        {inrP(b.cost)}
                      </TableCell>
                      <TableCell className="num text-right font-bold text-destructive">
                        -{inrP(b.loss)}
                      </TableCell>
                      <TableCell className="num text-right text-destructive font-medium">
                        -{pct(b.lossMargin)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
