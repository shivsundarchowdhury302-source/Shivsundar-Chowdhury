import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus, Search, UserCog, Upload } from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel, SampleBadge, Loading } from "@/components/app/ui-bits";
import { customerSummaryQuery } from "@/lib/queries";
import { inr, inrCompact } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { CustomerImportDialog } from "@/components/app/customer-import-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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

export const Route = createFileRoute("/_authenticated/customers/")({
  head: () => ({
    meta: [
      { title: "Customers — WholesaleIQ" },
      {
        name: "description",
        content: "Customer directory with sales, balances and credit limits.",
      },
    ],
  }),
  component: () => (
    <Guard path="/customers">
      <Customers />
    </Guard>
  ),
});

export const CATEGORIES = [
  "Retailer",
  "Wholesaler",
  "Sweet Shop",
  "Bakery",
  "Hotel / Restaurant",
  "Caterer",
  "Institution",
];

function Customers() {
  const { isFinance } = useAuth();
  const { data, isLoading } = useQuery(customerSummaryQuery());
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const rows = useMemo(
    () =>
      (data ?? []).filter(
        (c) =>
          (cat === "all" || c.category === cat) &&
          `${c.name} ${c.town} ${c.code}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [data, q, cat],
  );

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${data?.length ?? 0} active customer accounts`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <CustomerImportDialog />
            <Link to="/customer-management">
              <Button variant="outline">
                <UserCog className="h-4 w-4 mr-1" /> Manage accounts
              </Button>
            </Link>
            {isFinance && <AddCustomer />}
          </div>
        }
      />
      <Panel>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search name, town or code"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {isLoading ? (
          <Loading />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Town</TableHead>
                  {isFinance && (
                    <>
                      <TableHead className="text-right">Sales (90d)</TableHead>
                      <TableHead className="text-right">Gross profit</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-right">Credit limit</TableHead>
                    </>
                  )}
                  <TableHead>Last purchase</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => {
                  const over =
                    isFinance && c.credit_limit && Number(c.outstanding) > Number(c.credit_limit);
                  return (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          to="/customers/$id"
                          params={{ id: c.id! }}
                          className="font-medium hover:text-success"
                        >
                          {c.name}
                        </Link>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {c.code}
                          {c.is_sample && <SampleBadge />}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{c.category}</TableCell>
                      <TableCell className="text-sm">{c.town}</TableCell>
                      {isFinance && (
                        <>
                          <TableCell className="num text-right">
                            {inrCompact(c.total_sales)}
                          </TableCell>
                          <TableCell className="num text-right">
                            {inrCompact(c.gross_profit)}
                          </TableCell>
                          <TableCell className={`num text-right ${over ? "text-destructive" : ""}`}>
                            {inr(c.outstanding)}
                            {Number(c.overdue) > 0 && (
                              <div className="text-[11px] text-destructive">
                                {inr(c.overdue)} overdue
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="num text-right">
                            {c.credit_limit ? inr(c.credit_limit) : "—"}
                          </TableCell>
                        </>
                      )}
                      <TableCell className="num text-sm">{c.last_purchase_date ?? "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </>
  );
}

function AddCustomer() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    name: "",
    contact_person: "",
    phone: "",
    town: "Berhampore",
    category: "Retailer",
    credit_limit: "100000",
    credit_days: "15",
  });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase
      .from("customers")
      .insert({
        name: f.name.trim(),
        contact_person: f.contact_person,
        phone: f.phone,
        town: f.town,
        category: f.category,
        created_by: user!.id,
      })
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.from("credit_limits").insert({
      customer_id: data.id,
      credit_limit: Number(f.credit_limit) || 0,
      credit_days: Number(f.credit_days) || 15,
      created_by: user!.id,
    });
    toast.success("Customer added");
    qc.invalidateQueries({ queryKey: ["customer-summary"] });
    qc.invalidateQueries({ queryKey: ["customers-management"] });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" /> Add customer
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <Label>Business name</Label>
            <Input required value={f.name} onChange={set("name")} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact person</Label>
            <Input value={f.contact_person} onChange={set("contact_person")} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={f.phone} onChange={set("phone")} />
          </div>
          <div className="space-y-1.5">
            <Label>Town</Label>
            <Input value={f.town} onChange={set("town")} />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Credit limit (₹)</Label>
            <Input type="number" min={0} value={f.credit_limit} onChange={set("credit_limit")} />
          </div>
          <div className="space-y-1.5">
            <Label>Credit days</Label>
            <Input type="number" min={0} value={f.credit_days} onChange={set("credit_days")} />
          </div>
          <Button type="submit" className="col-span-2 mt-2">
            Save customer
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
