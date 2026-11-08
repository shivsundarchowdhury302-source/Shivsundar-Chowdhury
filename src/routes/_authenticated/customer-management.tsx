import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Edit2,
  UserCheck,
  UserX,
  AlertCircle,
  Phone,
  MapPin,
  Building,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel, Loading, SampleBadge } from "@/components/app/ui-bits";
import { inr, inrCompact } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { getDataSource } from "@/lib/data-source";
import { CustomerImportDialog } from "@/components/app/customer-import-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

export const Route = createFileRoute("/_authenticated/customer-management")({
  head: () => ({
    meta: [
      { title: "Customer Management — WholesaleIQ" },
      {
        name: "description",
        content: "Manage customer profiles, categorization, credit terms, and account activation.",
      },
    ],
  }),
  component: () => (
    <Guard path="/customer-management">
      <CustomerManagement />
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
] as const;

export interface ManagedCustomer {
  id: string;
  name: string;
  code: string | null;
  contact_person: string | null;
  phone: string | null;
  town: string | null;
  category: string;
  is_active: boolean;
  is_sample: boolean;
  created_at: string;
  credit_limit: number | null;
  credit_days: number | null;
  outstanding: number;
  total_sales: number;
}

export function CustomerManagement() {
  const { isFinance, user } = useAuth();
  const qc = useQueryClient();
  const source = getDataSource();

  // Load all customers (both active and inactive) for the current data source
  const {
    data: customers,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["customers-management", source],
    queryFn: async (): Promise<ManagedCustomer[]> => {
      const isDemo = source === "demo";

      // 1. Fetch all customer records
      const { data: custRows, error: custErr } = await supabase
        .from("customers")
        .select(
          "id, name, code, contact_person, phone, town, category, is_active, is_sample, created_at",
        )
        .eq("is_sample", isDemo)
        .order("name", { ascending: true });

      let rawCusts = custRows || [];
      if (custErr || rawCusts.length === 0) {
        if (isDemo) {
          const { DEMO_CUSTOMERS_RAW } = await import("@/lib/demo-data");
          rawCusts = DEMO_CUSTOMERS_RAW.map((d) => ({
            id: d.id,
            name: d.name,
            code: d.code,
            contact_person: d.contact_person,
            phone: d.phone,
            town: d.town,
            category: d.category,
            is_active: true,
            is_sample: true,
            created_at: new Date().toISOString(),
          }));
        } else {
          const { getLocalStoredCustomers } = await import("@/lib/customer-store");
          const local = getLocalStoredCustomers();
          rawCusts = local.map((d) => ({
            id: d.id,
            name: d.name,
            code: d.code,
            contact_person: d.contact_person,
            phone: d.phone,
            town: d.town,
            category: d.category,
            is_active: d.is_active,
            is_sample: false,
            created_at: d.created_at,
          }));
        }
      } else if (!isDemo) {
        const { getLocalStoredCustomers } = await import("@/lib/customer-store");
        const local = getLocalStoredCustomers();
        const existingCodes = new Set(rawCusts.map((c) => c.code?.toLowerCase()));
        for (const l of local) {
          if (!existingCodes.has(l.code.toLowerCase())) {
            rawCusts.push({
              id: l.id,
              name: l.name,
              code: l.code,
              contact_person: l.contact_person,
              phone: l.phone,
              town: l.town,
              category: l.category,
              is_active: l.is_active,
              is_sample: false,
              created_at: l.created_at,
            });
          }
        }
      }

      const ids = rawCusts.map((c) => c.id);

      // 2. Fetch latest credit limits
      const { data: limits } = await supabase
        .from("credit_limits")
        .select("customer_id, credit_limit, credit_days, effective_from")
        .in("customer_id", ids)
        .order("effective_from", { ascending: false });

      const limitMap = new Map<string, { credit_limit: number; credit_days: number }>();
      for (const l of limits ?? []) {
        if (!limitMap.has(l.customer_id)) {
          limitMap.set(l.customer_id, {
            credit_limit: Number(l.credit_limit),
            credit_days: Number(l.credit_days),
          });
        }
      }

      // 3. Fetch summary metrics from v_customer_summary if available
      const { data: summaries } = await supabase
        .from("v_customer_summary")
        .select("id, outstanding, total_sales")
        .eq("is_sample", isDemo);

      const summaryMap = new Map<string, { outstanding: number; total_sales: number }>();
      for (const s of summaries ?? []) {
        if (s.id) {
          summaryMap.set(s.id, {
            outstanding: Number(s.outstanding ?? 0),
            total_sales: Number(s.total_sales ?? 0),
          });
        }
      }

      return rawCusts.map((c) => {
        const lim = limitMap.get(c.id);
        const sm = summaryMap.get(c.id);
        return {
          id: c.id,
          name: c.name,
          code: c.code,
          contact_person: c.contact_person,
          phone: c.phone,
          town: c.town,
          category: c.category,
          is_active: c.is_active,
          is_sample: c.is_sample,
          created_at: c.created_at,
          credit_limit: lim?.credit_limit ?? null,
          credit_days: lim?.credit_days ?? null,
          outstanding: sm?.outstanding ?? 0,
          total_sales: sm?.total_sales ?? 0,
        };
      });
    },
  });

  // Search & Filter state
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");

  // Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<ManagedCustomer | null>(null);
  const [statusTarget, setStatusTarget] = useState<ManagedCustomer | null>(null);

  // Form states
  const [form, setForm] = useState({
    name: "",
    code: "",
    contact_person: "",
    phone: "",
    town: "Berhampore",
    category: "Retailer",
    credit_limit: "100000",
    credit_days: "15",
  });
  const [saving, setSaving] = useState(false);

  // Filtered rows
  const rows = useMemo(() => {
    return (customers ?? []).filter((c) => {
      if (cat !== "all" && c.category !== cat) return false;
      if (status === "active" && !c.is_active) return false;
      if (status === "inactive" && c.is_active) return false;
      if (!q.trim()) return true;
      const term = q.toLowerCase();
      const text =
        `${c.name} ${c.code ?? ""} ${c.town ?? ""} ${c.phone ?? ""} ${c.contact_person ?? ""}`.toLowerCase();
      return text.includes(term);
    });
  }, [customers, q, cat, status]);

  const activeCount = (customers ?? []).filter((c) => c.is_active).length;
  const inactiveCount = (customers ?? []).filter((c) => !c.is_active).length;

  function openAdd() {
    setForm({
      name: "",
      code: "",
      contact_person: "",
      phone: "",
      town: "Berhampore",
      category: "Retailer",
      credit_limit: "100000",
      credit_days: "15",
    });
    setAddOpen(true);
  }

  function openEdit(c: ManagedCustomer) {
    setEditCustomer(c);
    setForm({
      name: c.name,
      code: c.code ?? "",
      contact_person: c.contact_person ?? "",
      phone: c.phone ?? "",
      town: c.town ?? "",
      category: c.category,
      credit_limit: String(c.credit_limit ?? 0),
      credit_days: String(c.credit_days ?? 15),
    });
  }

  async function handleSaveNew(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Business name is required");
      return;
    }
    setSaving(true);
    try {
      const isDemo = source === "demo";
      const payload = {
        name: form.name.trim(),
        code: form.code.trim() || null,
        contact_person: form.contact_person.trim() || null,
        phone: form.phone.trim() || null,
        town: form.town.trim() || null,
        category: form.category,
        is_active: true,
        is_sample: isDemo,
        created_by: user?.id ?? null,
      };

      // Try RPC if real data or fallback to direct insert
      let newId: string | null = null;
      if (!isDemo && isFinance) {
        try {
          const { data, error } = await supabase.rpc("save_customer", {
            _id: null,
            _values: {
              name: payload.name,
              code: payload.code,
              contact_person: payload.contact_person,
              phone: payload.phone,
              town: payload.town,
              category: payload.category,
              credit_limit: Number(form.credit_limit) || 0,
              credit_days: Number(form.credit_days) || 15,
            },
          });
          if (error) throw error;
          newId = data;
        } catch {
          // fallback to standard insert
        }
      }

      if (!newId) {
        const { data, error } = await supabase
          .from("customers")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        newId = data.id;

        // Add initial credit limit
        await supabase.from("credit_limits").insert({
          customer_id: newId,
          credit_limit: Number(form.credit_limit) || 0,
          credit_days: Number(form.credit_days) || 15,
          effective_from: new Date().toISOString().slice(0, 10),
          created_by: user?.id ?? null,
        });
      }

      toast.success(`Customer "${form.name.trim()}" added successfully`);
      setAddOpen(false);
      await qc.invalidateQueries({ queryKey: ["customers-management"] });
      await qc.invalidateQueries({ queryKey: ["customer-summary"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add customer");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editCustomer) return;
    if (!form.name.trim()) {
      toast.error("Business name is required");
      return;
    }
    setSaving(true);
    try {
      const isDemo = source === "demo";
      // Try save_customer RPC for real finance records
      let updatedViaRpc = false;
      if (!isDemo && isFinance && editCustomer.is_active) {
        try {
          const { error } = await supabase.rpc("save_customer", {
            _id: editCustomer.id,
            _values: {
              name: form.name.trim(),
              code: form.code.trim() || null,
              contact_person: form.contact_person.trim() || null,
              phone: form.phone.trim() || null,
              town: form.town.trim() || null,
              category: form.category,
              credit_limit: Number(form.credit_limit) || 0,
              credit_days: Number(form.credit_days) || 15,
            },
          });
          if (!error) updatedViaRpc = true;
        } catch {
          updatedViaRpc = false;
        }
      }

      if (!updatedViaRpc) {
        const { error: custErr } = await supabase
          .from("customers")
          .update({
            name: form.name.trim(),
            code: form.code.trim() || null,
            contact_person: form.contact_person.trim() || null,
            phone: form.phone.trim() || null,
            town: form.town.trim() || null,
            category: form.category,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editCustomer.id);
        if (custErr) throw custErr;

        // If credit limit or days changed, insert new version
        const newLim = Number(form.credit_limit) || 0;
        const newDays = Number(form.credit_days) || 15;
        if (newLim !== editCustomer.credit_limit || newDays !== editCustomer.credit_days) {
          await supabase.from("credit_limits").insert({
            customer_id: editCustomer.id,
            credit_limit: newLim,
            credit_days: newDays,
            effective_from: new Date().toISOString().slice(0, 10),
            created_by: user?.id ?? null,
          });
        }
      }

      toast.success("Customer record updated");
      setEditCustomer(null);
      await qc.invalidateQueries({ queryKey: ["customers-management"] });
      await qc.invalidateQueries({ queryKey: ["customer-summary"] });
      await qc.invalidateQueries({ queryKey: ["customer", editCustomer.id] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update customer");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleStatus() {
    if (!statusTarget) return;
    const nextStatus = !statusTarget.is_active;
    const actionLabel = nextStatus ? "reactivated" : "deactivated";
    try {
      const { error } = await supabase
        .from("customers")
        .update({
          is_active: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", statusTarget.id);

      if (error) throw error;

      toast.success(`Customer "${statusTarget.name}" has been ${actionLabel}`);
      setStatusTarget(null);
      await qc.invalidateQueries({ queryKey: ["customers-management"] });
      await qc.invalidateQueries({ queryKey: ["customer-summary"] });
      await qc.invalidateQueries({ queryKey: ["customer", statusTarget.id] });
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : `Failed to ${nextStatus ? "activate" : "deactivate"} customer`,
      );
    }
  }

  return (
    <>
      <PageHeader
        title="Customer Management"
        subtitle="Full lifecycle customer control: profiles, categorization, credit limits, and active status."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh customer database records"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <CustomerImportDialog />
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add customer
            </Button>
          </div>
        }
      />

      {/* Summary KPI Badges */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Total Accounts</div>
          <div className="num mt-1 text-2xl font-bold">{customers?.length ?? 0}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Active Accounts</div>
          <div className="num mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {activeCount}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Inactive / Paused</div>
          <div className="num mt-1 text-2xl font-bold text-muted-foreground">{inactiveCount}</div>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <div className="text-xs font-medium text-muted-foreground">Categories</div>
          <div className="num mt-1 text-2xl font-bold">{CATEGORIES.length}</div>
        </div>
      </div>

      <Panel>
        {/* Search & Filters */}
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by customer name, code, phone, or town…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Category" />
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

            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "all" | "active" | "inactive")}
            >
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active only</SelectItem>
                <SelectItem value="inactive">Inactive only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Customer Table */}
        {isLoading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            No customers match the current search and filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead className="text-right">Credit limit</TableHead>
                  <TableHead className="text-right">Terms</TableHead>
                  {isFinance && <TableHead className="text-right">Outstanding</TableHead>}
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((c) => {
                  const over = isFinance && c.credit_limit && c.outstanding > c.credit_limit;
                  return (
                    <TableRow key={c.id} className={!c.is_active ? "opacity-60 bg-muted/20" : ""}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Link
                            to="/customers/$id"
                            params={{ id: c.id }}
                            className="font-medium text-foreground hover:text-primary transition-colors hover:underline"
                          >
                            {c.name}
                          </Link>
                          {c.is_sample && <SampleBadge />}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {c.code ?? "—"}
                        </div>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="font-normal text-xs">
                          {c.category}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          {c.town || "—"}
                        </span>
                      </TableCell>

                      <TableCell className="text-sm">
                        <div>{c.contact_person || "—"}</div>
                        {c.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                            <Phone className="h-3 w-3" />
                            {c.phone}
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="num text-right font-medium">
                        {c.credit_limit ? inr(c.credit_limit) : "—"}
                      </TableCell>

                      <TableCell className="num text-right text-sm">
                        {c.credit_days ? `${c.credit_days} days` : "—"}
                      </TableCell>

                      {isFinance && (
                        <TableCell
                          className={`num text-right ${over ? "font-semibold text-destructive" : ""}`}
                        >
                          {inr(c.outstanding)}
                        </TableCell>
                      )}

                      <TableCell className="text-center">
                        {c.is_active ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 border-emerald-500/30 dark:text-emerald-400">
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground border-dashed">
                            Inactive
                          </Badge>
                        )}
                      </TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs"
                            onClick={() => openEdit(c)}
                            title="Edit customer and credit limit"
                          >
                            <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-8 px-2 text-xs ${
                              c.is_active
                                ? "text-muted-foreground hover:text-destructive"
                                : "text-emerald-600 hover:text-emerald-700"
                            }`}
                            onClick={() => setStatusTarget(c)}
                            title={c.is_active ? "Deactivate account" : "Reactivate account"}
                          >
                            {c.is_active ? (
                              <>
                                <UserX className="h-3.5 w-3.5 mr-1" /> Deactivate
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5 mr-1" /> Activate
                              </>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {/* Add Customer Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Customer</DialogTitle>
            <DialogDescription>
              Create a new customer account with verified business category and credit parameters.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveNew} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="add-name">
                  Business Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="add-name"
                  required
                  placeholder="e.g. Modern Sweets & Bakery"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-code">Customer Code</Label>
                <Input
                  id="add-code"
                  placeholder="e.g. C-104"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger id="add-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((catName) => (
                      <SelectItem key={catName} value={catName}>
                        {catName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-contact">Contact Person</Label>
                <Input
                  id="add-contact"
                  placeholder="e.g. Rajesh Ghosh"
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-phone">Phone Number</Label>
                <Input
                  id="add-phone"
                  placeholder="e.g. 9832000000"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="add-town">Town / Market Location</Label>
                <Input
                  id="add-town"
                  placeholder="e.g. Berhampore"
                  value={form.town}
                  onChange={(e) => setForm({ ...form, town: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-limit">Credit Limit (₹)</Label>
                <Input
                  id="add-limit"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.credit_limit}
                  onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-days">Credit Terms (Days)</Label>
                <Input
                  id="add-days"
                  type="number"
                  min={0}
                  max={180}
                  value={form.credit_days}
                  onChange={(e) => setForm({ ...form, credit_days: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Create Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={!!editCustomer} onOpenChange={(open) => !open && setEditCustomer(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Customer: {editCustomer?.name}</DialogTitle>
            <DialogDescription>
              Update business details, contact information, category, or credit terms.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-name">
                  Business Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="edit-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-code">Customer Code</Label>
                <Input
                  id="edit-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v })}
                >
                  <SelectTrigger id="edit-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((catName) => (
                      <SelectItem key={catName} value={catName}>
                        {catName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-contact">Contact Person</Label>
                <Input
                  id="edit-contact"
                  value={form.contact_person}
                  onChange={(e) => setForm({ ...form, contact_person: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-phone">Phone Number</Label>
                <Input
                  id="edit-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>

              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="edit-town">Town / Market Location</Label>
                <Input
                  id="edit-town"
                  value={form.town}
                  onChange={(e) => setForm({ ...form, town: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-limit">Credit Limit (₹)</Label>
                <Input
                  id="edit-limit"
                  type="number"
                  min={0}
                  step={1000}
                  value={form.credit_limit}
                  onChange={(e) => setForm({ ...form, credit_limit: e.target.value })}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="edit-days">Credit Terms (Days)</Label>
                <Input
                  id="edit-days"
                  type="number"
                  min={0}
                  max={180}
                  value={form.credit_days}
                  onChange={(e) => setForm({ ...form, credit_days: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditCustomer(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Updating…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activation / Deactivation Confirmation */}
      <AlertDialog open={!!statusTarget} onOpenChange={(open) => !open && setStatusTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusTarget?.is_active
                ? "Deactivate Customer Account?"
                : "Reactivate Customer Account?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusTarget?.is_active ? (
                <>
                  Deactivating <strong>{statusTarget?.name}</strong> will hide them from active
                  sales operations while preserving all historical sales, ledger entries, and
                  payment allocations.
                </>
              ) : (
                <>
                  Reactivating <strong>{statusTarget?.name}</strong> will restore this account to
                  active customer lists and allow new transactions.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleStatus}
              className={
                statusTarget?.is_active
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }
            >
              {statusTarget?.is_active ? "Confirm Deactivation" : "Reactivate Account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
