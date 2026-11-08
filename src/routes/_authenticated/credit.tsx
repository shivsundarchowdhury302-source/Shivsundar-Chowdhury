import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search, AlertTriangle, CheckCircle2, Clock, ArrowUpDown, Filter } from "lucide-react";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel, SampleBanner, Stat, Loading } from "@/components/app/ui-bits";
import { customerSummaryQuery } from "@/lib/queries";
import { inr, inrCompact, pct } from "@/lib/format";
import { outstanding, creditUtilisation } from "@/lib/financial";
import { supabase } from "@/integrations/supabase/client";
import { getDataSource } from "@/lib/data-source";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export const Route = createFileRoute("/_authenticated/credit")({
  head: () => ({
    meta: [
      { title: "Credit Management — WholesaleIQ" },
      {
        name: "description",
        content:
          "Outstanding balances, allocated payments, overdue aging and credit limit utilization.",
      },
    ],
  }),
  component: () => (
    <Guard path="/credit">
      <Credit />
    </Guard>
  ),
});

interface InvoiceBalanceRow {
  id: string;
  invoice_no: string;
  sale_date: string;
  due_date: string | null;
  total_amount: number;
  allocated: number;
  unpaid: number;
  customer_id: string;
  customers?: { name: string; town: string | null };
}

function Credit() {
  const source = getDataSource();
  const summaryQuery = useQuery(customerSummaryQuery());

  // Load unpaid credit invoices with their allocations
  const invoicesQuery = useQuery({
    queryKey: ["credit-invoices", source],
    queryFn: async (): Promise<InvoiceBalanceRow[]> => {
      const isDemo = source === "demo";
      const { data, error } = await supabase
        .from("v_invoice_balances")
        .select(
          "id, invoice_no, sale_date, due_date, total_amount, allocated, unpaid, customer_id, customers(name, town)",
        )
        .eq("is_sample", isDemo)
        .gt("unpaid", 0)
        .order("due_date", { ascending: true });

      if (error) {
        // Fallback to querying sales directly if needed
        return [];
      }
      return (data as unknown as InvoiceBalanceRow[]) ?? [];
    },
  });

  const [q, setQ] = useState("");
  const [filterType, setFilterType] = useState<"all" | "overdue" | "over_limit">("all");
  const [tab, setTab] = useState<"customers" | "invoices">("customers");

  const customers = useMemo(() => summaryQuery.data ?? [], [summaryQuery.data]);
  const invoices = useMemo(() => invoicesQuery.data ?? [], [invoicesQuery.data]);

  // Filtered customer rows
  const filteredCustomers = useMemo(() => {
    return customers
      .filter((c) => {
        if (filterType === "overdue" && Number(c.overdue) <= 0) return false;
        if (
          filterType === "over_limit" &&
          (!c.credit_limit || Number(c.outstanding) <= Number(c.credit_limit))
        ) {
          return false;
        }
        if (!q.trim()) return true;
        const text = `${c.name} ${c.town ?? ""} ${c.code ?? ""}`.toLowerCase();
        return text.includes(q.toLowerCase());
      })
      .sort(
        (a, b) =>
          Number(b.overdue) - Number(a.overdue) || Number(b.outstanding) - Number(a.outstanding),
      );
  }, [customers, q, filterType]);

  // Filtered invoice rows
  const filteredInvoices = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return invoices.filter((inv) => {
      const isOverdue = inv.due_date ? inv.due_date < today : false;
      if (filterType === "overdue" && !isOverdue) return false;
      if (!q.trim()) return true;
      const text =
        `${inv.invoice_no} ${inv.customers?.name ?? ""} ${inv.customers?.town ?? ""}`.toLowerCase();
      return text.includes(q.toLowerCase());
    });
  }, [invoices, q, filterType]);

  if (summaryQuery.isLoading) return <Loading />;

  const out = customers.reduce((a, c) => a + Math.max(0, Number(c.outstanding)), 0);
  const od = customers.reduce((a, c) => a + Number(c.overdue), 0);
  const overdueCount = customers.filter((c) => Number(c.overdue) > 0).length;
  const overLimit = customers.filter(
    (c) => c.credit_limit && Number(c.outstanding) > Number(c.credit_limit),
  ).length;
  const totalAllocated = invoices.reduce((sum, inv) => sum + Number(inv.allocated ?? 0), 0);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        title="Credit Management"
        subtitle="Outstanding balances strictly calculated from actual credit sales minus invoice-allocated payments."
      />
      <SampleBanner />

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Total Outstanding Credit"
          value={inrCompact(out)}
          hint="Net receivables across all accounts"
        />
        <Stat
          label="Overdue Balances"
          value={inrCompact(od)}
          tone="bad"
          hint={`${pct((od / Math.max(1, out)) * 100)} of outstanding`}
        />
        <Stat
          label="Overdue Customers"
          value={String(overdueCount)}
          tone={overdueCount > 0 ? "warn" : "good"}
          hint="Accounts past agreed payment terms"
        />
        <Stat
          label="Over Credit Limit"
          value={String(overLimit)}
          tone={overLimit > 0 ? "bad" : "default"}
          hint="Accounts exceeding sanctioned limit"
        />
      </div>

      <Panel>
        {/* Navigation Tabs & Search Toolbar */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "customers" | "invoices")}
            className="w-auto"
          >
            <TabsList>
              <TabsTrigger value="customers">Customer Balances ({customers.length})</TabsTrigger>
              <TabsTrigger value="invoices">
                Unpaid Invoices & Allocations ({invoices.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9 h-9"
                placeholder={
                  tab === "customers" ? "Search customer or town…" : "Search invoice # or customer…"
                }
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>

            <Select
              value={filterType}
              onValueChange={(v) => setFilterType(v as "all" | "overdue" | "over_limit")}
            >
              <SelectTrigger className="w-36 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                <SelectItem value="overdue">Overdue Only</SelectItem>
                <SelectItem value="over_limit">Over Limit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* View 1: Customer Balances */}
        {tab === "customers" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Outstanding (₹)</TableHead>
                  <TableHead className="text-right">Overdue (₹)</TableHead>
                  <TableHead>Credit Limit Usage</TableHead>
                  <TableHead className="text-right">Terms</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No customer accounts match the selected filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((c) => {
                    const balance = Number(c.outstanding ?? 0);
                    const limit = Number(c.credit_limit ?? 0);
                    const utilisation = creditUtilisation(balance, limit);
                    const isOver = limit > 0 && balance > limit;
                    const isOd = Number(c.overdue) > 0;

                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Link
                            to="/customers/$id"
                            params={{ id: c.id! }}
                            className="font-medium hover:text-primary transition-colors hover:underline"
                          >
                            {c.name}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {c.category} · {c.town}
                          </div>
                        </TableCell>

                        <TableCell
                          className={`num text-right font-medium ${isOver ? "text-destructive" : ""}`}
                        >
                          {inr(balance)}
                        </TableCell>

                        <TableCell
                          className={`num text-right ${
                            isOd ? "font-semibold text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {inr(c.overdue)}
                        </TableCell>

                        <TableCell className="min-w-48">
                          {limit > 0 ? (
                            <div>
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={Math.min(100, utilisation ?? 0)}
                                  className={`h-1.5 ${isOver ? "[&>div]:bg-destructive" : ""}`}
                                />
                                <span
                                  className={`num w-12 text-right text-xs font-medium ${
                                    isOver ? "text-destructive" : ""
                                  }`}
                                >
                                  {pct(utilisation, 0)}
                                </span>
                              </div>
                              <div className="num text-[11px] text-muted-foreground mt-0.5">
                                of {inr(limit)} limit
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">No limit set</span>
                          )}
                        </TableCell>

                        <TableCell className="num text-right text-sm">
                          {c.credit_days ? `${c.credit_days} d` : "—"}
                        </TableCell>

                        <TableCell className="text-center">
                          {isOver ? (
                            <Badge variant="destructive" className="text-xs">
                              Limit Exceeded
                            </Badge>
                          ) : isOd ? (
                            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs">
                              Overdue
                            </Badge>
                          ) : balance > 0 ? (
                            <Badge variant="outline" className="text-xs">
                              Current
                            </Badge>
                          ) : (
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                              Settled
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* View 2: Invoices & Payment Allocations */}
        {tab === "invoices" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Allocated Payment</TableHead>
                  <TableHead className="text-right">Unpaid Balance</TableHead>
                  <TableHead className="text-center">Ageing Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No unpaid credit invoices found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((inv) => {
                    const isOverdue = inv.due_date ? inv.due_date < today : false;
                    const daysPastDue = inv.due_date
                      ? Math.max(
                          0,
                          Math.floor((Date.parse(today) - Date.parse(inv.due_date)) / 86400000),
                        )
                      : 0;

                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-mono font-medium text-sm">
                          {inv.invoice_no}
                        </TableCell>

                        <TableCell>
                          <Link
                            to="/customers/$id"
                            params={{ id: inv.customer_id }}
                            className="font-medium hover:text-primary transition-colors hover:underline"
                          >
                            {inv.customers?.name ?? "Customer"}
                          </Link>
                          {inv.customers?.town && (
                            <div className="text-xs text-muted-foreground">
                              {inv.customers.town}
                            </div>
                          )}
                        </TableCell>

                        <TableCell className="num text-sm text-muted-foreground">
                          {inv.sale_date}
                        </TableCell>

                        <TableCell
                          className={`num text-sm ${isOverdue ? "text-destructive font-medium" : ""}`}
                        >
                          {inv.due_date ?? "—"}
                        </TableCell>

                        <TableCell className="num text-right font-medium">
                          {inr(inv.total_amount)}
                        </TableCell>

                        <TableCell className="num text-right text-emerald-600 dark:text-emerald-400">
                          {inv.allocated > 0 ? inr(inv.allocated) : "₹0"}
                        </TableCell>

                        <TableCell className="num text-right font-bold text-destructive">
                          {inr(inv.unpaid)}
                        </TableCell>

                        <TableCell className="text-center">
                          {isOverdue ? (
                            <Badge variant="destructive" className="text-xs">
                              {daysPastDue}d overdue
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Not due
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        <div className="mt-4 pt-3 border-t text-xs text-muted-foreground flex items-center justify-between">
          <span>
            Formula: Unpaid Balance = Credit Sales Amount − Payments Allocated Specifically to the
            Invoice.
          </span>
          <span>
            Unallocated general payments are never assumed to settle invoices without explicit
            allocation.
          </span>
        </div>
      </Panel>
    </>
  );
}
