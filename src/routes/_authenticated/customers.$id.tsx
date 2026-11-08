import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel, SampleBadge, Stat, Loading } from "@/components/app/ui-bits";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { inr, inrCompact, inrP, marginPct, pct } from "@/lib/format";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/customers/$id")({
  head: () => ({
    meta: [
      { title: "Customer profile — WholesaleIQ" },
      {
        name: "description",
        content: "Customer purchase history, balance, credit and profitability.",
      },
    ],
  }),
  component: () => (
    <Guard path="/customers">
      <CustomerProfile />
    </Guard>
  ),
});

function CustomerProfile() {
  const { id } = Route.useParams();
  const { isFinance } = useAuth();
  const summary = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("v_customer_summary")
          .select("*")
          .eq("id", id)
          .maybeSingle();
        if (data) return data;
      } catch {
        // Fallback to local store
      }
      const { getLocalStoredCustomers } = await import("@/lib/customer-store");
      const local = getLocalStoredCustomers().find((c) => c.id === id);
      if (local) {
        return {
          id: local.id,
          code: local.code,
          name: local.name,
          category: local.category,
          town: local.town || "Berhampore",
          phone: local.phone || "",
          contact_person: local.contact_person || "",
          is_sample: local.is_sample,
          total_sales: local.total_sales,
          total_cost: Math.round(local.total_sales * 0.88),
          gross_profit: local.gross_profit,
          invoice_count: local.invoice_count,
          last_purchase_date: local.last_purchase_date || "",
          outstanding: local.outstanding,
          overdue: 0,
          credit_limit: local.credit_limit,
          credit_days: local.credit_days,
        };
      }
      return null;
    },
  });
  const sales = useQuery({
    enabled: isFinance,
    queryKey: ["customer-sales", id],
    queryFn: async () =>
      (
        await supabase
          .from("sales")
          .select("*")
          .eq("customer_id", id)
          .order("sale_date", { ascending: false })
          .limit(200)
      ).data ?? [],
  });
  const pays = useQuery({
    enabled: isFinance,
    queryKey: ["customer-pays", id],
    queryFn: async () =>
      (
        await supabase
          .from("customer_payments")
          .select("*")
          .eq("customer_id", id)
          .order("payment_date", { ascending: false })
      ).data ?? [],
  });
  const prices = useQuery({
    enabled: isFinance,
    queryKey: ["customer-prices", id],
    queryFn: async () =>
      (
        await supabase
          .from("customer_price_history")
          .select("*, products(name)")
          .eq("customer_id", id)
          .order("effective_date", { ascending: false })
      ).data ?? [],
  });

  const c = summary.data;
  if (summary.isLoading) return <Loading />;
  if (!c) return <p className="text-sm text-muted-foreground">Customer not found.</p>;

  const monthly = new Map<string, number>();
  for (const s of sales.data ?? [])
    monthly.set(
      s.sale_date.slice(0, 7),
      (monthly.get(s.sale_date.slice(0, 7)) ?? 0) + Number(s.total_amount),
    );
  const monthlyRows = [...monthly.entries()].sort().map(([m, v]) => ({ m, v }));
  const latestPrices = new Map<string, (typeof prices.data & object)[number]>();
  for (const p of prices.data ?? [])
    if (!latestPrices.has(p.product_id)) latestPrices.set(p.product_id, p);

  return (
    <>
      <Link
        to="/customers"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Customers
      </Link>
      <PageHeader
        title={c.name!}
        subtitle={`${c.category} · ${c.town} · ${c.contact_person ?? ""} · ${c.phone ?? ""}`}
        actions={c.is_sample && <SampleBadge />}
      />
      {!isFinance ? (
        <Panel>
          <p className="text-sm text-muted-foreground">
            Financial details are visible to Owner and Management only.
          </p>
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Stat label="Total sales (90d)" value={inrCompact(c.total_sales)} />
            <Stat
              label="Gross profit"
              value={inrCompact(c.gross_profit)}
              hint={pct(marginPct(Number(c.total_sales), Number(c.total_cost)))}
              tone="good"
            />
            <Stat
              label="Outstanding"
              value={inr(c.outstanding)}
              tone={Number(c.outstanding) > Number(c.credit_limit ?? Infinity) ? "bad" : "default"}
            />
            <Stat
              label="Overdue"
              value={inr(c.overdue)}
              tone={Number(c.overdue) > 0 ? "bad" : "default"}
            />
            <Stat
              label="Credit limit"
              value={c.credit_limit ? inr(c.credit_limit) : "—"}
              hint={`${c.credit_days ?? "—"} days terms`}
            />
            <Stat
              label="Avg purchase"
              value={inr(Number(c.total_sales) / Math.max(1, Number(c.invoice_count)))}
              hint={`Last: ${c.last_purchase_date ?? "—"}`}
            />
          </div>
          <Panel title="Monthly purchases">
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={monthlyRows}>
                  <CartesianGrid stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="m" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={inrCompact} tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(v) => inr(Number(v))} />
                  <Bar dataKey="v" name="Sales" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
          <Tabs defaultValue="sales">
            <TabsList>
              <TabsTrigger value="sales">Purchase history</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="prices">Negotiated prices</TabsTrigger>
            </TabsList>
            <TabsContent value="sales">
              <Panel>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Margin</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(sales.data ?? []).slice(0, 50).map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="num text-sm">{s.invoice_no}</TableCell>
                        <TableCell className="num text-sm">{s.sale_date}</TableCell>
                        <TableCell className="num text-right">{inr(s.total_amount)}</TableCell>
                        <TableCell className="num text-right">
                          {pct(marginPct(Number(s.total_amount), Number(s.total_cost)))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            </TabsContent>
            <TabsContent value="payments">
              <Panel>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(pays.data ?? []).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="num text-sm">{p.payment_date}</TableCell>
                        <TableCell className="text-sm">{p.method}</TableCell>
                        <TableCell className="num text-sm">{p.reference}</TableCell>
                        <TableCell className="num text-right">{inr(p.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            </TabsContent>
            <TabsContent value="prices">
              <Panel>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead>Effective</TableHead>
                      <TableHead className="text-right">Price / kg</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...latestPrices.values()].map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="text-sm">{p.products?.name}</TableCell>
                        <TableCell className="num text-sm">{p.effective_date}</TableCell>
                        <TableCell className="num text-right">{inrP(p.price)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </>
  );
}
