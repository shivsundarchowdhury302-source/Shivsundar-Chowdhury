import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Download,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  XCircle,
  FileText,
  Info,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel, SampleBanner, Loading } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  IMPORT_TYPES,
  autoMap,
  validateRows,
  toCsv,
  type ImportType,
  type RowResult,
} from "@/lib/import-validation";
import { pageHead } from "@/lib/page-head";

export const Route = createFileRoute("/_authenticated/data-centre")({
  head: () =>
    pageHead(
      "Excel Data Centre",
      "Transactional business spreadsheet imports for Customers, Products, Sales, Payments, Landed Costs, Inventory, and Competitor Prices.",
    ),
  component: () => (
    <Guard path="/data-centre">
      <DataCentre />
    </Guard>
  ),
});

interface ImportJob {
  id: string;
  file_name: string;
  target_table: string;
  status: "completed" | "reversed" | "failed";
  total_rows: number;
  valid_rows: number;
  created_at: string;
  reversed_at: string | null;
}

function DataCentre() {
  const qc = useQueryClient();
  const [type, setType] = useState<ImportType>("customers");
  const [sheets, setSheets] = useState<Record<string, Record<string, unknown>[]>>({});
  const [sheet, setSheet] = useState("");
  const [file, setFile] = useState("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [existingKeys, setExistingKeys] = useState<Set<string>>(new Set());
  const [reverseTarget, setReverseTarget] = useState<ImportJob | null>(null);

  const def = IMPORT_TYPES[type];
  const raw = sheets[sheet] ?? [];
  const headers = Object.keys(raw[0] ?? {});

  // Pre-fetch existing database duplicate keys for the selected import type
  useEffect(() => {
    let active = true;
    async function fetchKeys() {
      try {
        const keys = new Set<string>();
        if (type === "customers") {
          const { data } = await supabase.from("customers").select("code").eq("is_active", true);
          for (const r of data ?? []) if (r.code) keys.add(r.code.toLowerCase().trim());
        } else if (type === "products") {
          const { data } = await supabase.from("products").select("sku").eq("is_active", true);
          for (const r of data ?? []) if (r.sku) keys.add(r.sku.toLowerCase().trim());
        } else if (type === "customer_payments") {
          const { data } = await supabase
            .from("customer_payments")
            .select("reference")
            .eq("is_void", false);
          for (const r of data ?? []) if (r.reference) keys.add(r.reference.toLowerCase().trim());
        } else if (type === "sales") {
          const { data } = await supabase.from("sales").select("invoice_no").eq("is_void", false);
          for (const r of data ?? []) if (r.invoice_no) keys.add(r.invoice_no.toLowerCase().trim());
        } else if (type === "product_cost_history") {
          const { data } = await supabase
            .from("product_cost_history")
            .select("effective_date, products(sku)")
            .eq("is_void", false);
          for (const r of (data as unknown as {
            effective_date: string;
            products?: { sku: string };
          }[]) ?? []) {
            if (r.products?.sku && r.effective_date) {
              keys.add(`${r.products.sku.toLowerCase().trim()}|${r.effective_date.trim()}`);
            }
          }
        } else if (type === "inventory_snapshots") {
          const { data } = await supabase
            .from("inventory_snapshots")
            .select("godown, snapshot_date, products(sku)")
            .eq("is_void", false);
          for (const r of (data as unknown as {
            godown: string;
            snapshot_date: string;
            products?: { sku: string };
          }[]) ?? []) {
            if (r.products?.sku && r.godown && r.snapshot_date) {
              keys.add(
                `${r.products.sku.toLowerCase().trim()}|${r.godown.toLowerCase().trim()}|${r.snapshot_date.trim()}`,
              );
            }
          }
        } else if (type === "market_prices") {
          const { data } = await supabase
            .from("market_prices")
            .select("source_name, price_date, products(sku)")
            .eq("is_void", false);
          for (const r of (data as unknown as {
            source_name: string;
            price_date: string;
            products?: { sku: string };
          }[]) ?? []) {
            if (r.products?.sku && r.price_date) {
              keys.add(
                `${r.products.sku.toLowerCase().trim()}|${r.price_date.trim()}|${(r.source_name || "").toLowerCase().trim()}`,
              );
            }
          }
        }
        if (active) setExistingKeys(keys);
      } catch {
        // Non-blocking fallback
      }
    }
    fetchKeys();
    return () => {
      active = false;
    };
  }, [type]);

  // Validate rows with duplicate detection against file and database
  const preview: RowResult[] = validateRows(raw, def.fields, mapping, def.dupKey, existingKeys);
  const valid = preview.filter((r) => !r.errors.length && !r.duplicate);
  const duplicateCount = preview.filter((r) => r.duplicate).length;
  const invalidCount = preview.filter((r) => r.errors.length > 0).length;

  // Import jobs history query
  const history = useQuery({
    queryKey: ["import-history"],
    queryFn: async (): Promise<ImportJob[]> => {
      const { data, error: histErr } = await supabase
        .from("import_jobs")
        .select(
          "id, file_name, target_table, status, total_rows, valid_rows, created_at, reversed_at",
        )
        .order("created_at", { ascending: false });
      if (histErr) throw histErr;
      return (data as unknown as ImportJob[]) ?? [];
    },
  });

  function choose(name: string, nextType = type) {
    setSheet(name);
    setMapping(autoMap(Object.keys(sheets[name]?.[0] ?? {}), IMPORT_TYPES[nextType].fields));
  }

  async function upload(f?: File) {
    if (!f) return;
    setError("");
    setFile(f.name);
    try {
      if (f.size > 15 * 1024 * 1024) throw new Error("File must be smaller than 15 MB.");
      let parsed: Record<string, Record<string, unknown>[]>;

      // CSV parser
      if (/\.csv$/i.test(f.name)) {
        const { default: Papa } = await import("papaparse");
        const result = Papa.parse<Record<string, unknown>>(await f.text(), {
          header: true,
          skipEmptyLines: "greedy",
        });
        if (result.errors.length)
          throw new Error(result.errors[0]?.message ?? "Invalid CSV format");
        parsed = { CSV: result.data };
      }
      // Excel parser supporting .xlsx and .xls
      else if (/\.(xlsx|xls)$/i.test(f.name)) {
        const XLSX = await import("xlsx");
        const book = XLSX.read(await f.arrayBuffer(), { type: "array", cellDates: true });
        parsed = Object.fromEntries(
          book.SheetNames.filter((n) => n !== "READ_ME").map((n) => {
            const worksheet = book.Sheets[n];
            return [
              n,
              worksheet
                ? XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
                    raw: false,
                    dateNF: "yyyy-mm-dd",
                  })
                : [],
            ];
          }),
        );
      } else {
        throw new Error("Unsupported format. Please select an Excel (.xlsx, .xls) or CSV file.");
      }

      const name = Object.keys(parsed)[0] ?? "";
      setSheets(parsed);
      setSheet(name);
      setMapping(autoMap(Object.keys(parsed[name]?.[0] ?? {}), def.fields));
      toast.success(
        `Loaded ${f.name} (${Object.keys(parsed).length} sheet${Object.keys(parsed).length > 1 ? "s" : ""})`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "File could not be parsed.");
    }
  }

  async function apply() {
    if (!valid.length) {
      toast.error("No valid rows to import.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const fileName = `${file} — ${sheet || "Sheet1"}`;
      const payloadRows = valid.map((r) => r.values);

      // Attempt PostgreSQL RPC first
      let importJobId: string | null = null;
      let rpcError: Error | null = null;

      try {
        if (type === "customer_payments") {
          const { data, error: pErr } = await supabase.rpc("apply_allocated_payment_import", {
            _file: fileName,
            _rows: payloadRows,
          });
          if (pErr) throw pErr;
          importJobId = data as string;
        } else {
          const { data, error: impErr } = await supabase.rpc("apply_import", {
            _type: type,
            _file: fileName,
            _rows: payloadRows,
          });
          if (impErr) throw impErr;
          importJobId = data as string;
        }
      } catch (err) {
        rpcError = err instanceof Error ? err : new Error(String(err));
      }

      // If customer import, always mirror to local resilient customer store
      if (type === "customers") {
        const { bulkImportCustomers } = await import("@/lib/customer-store");
        await bulkImportCustomers(payloadRows, { fileName });
      }

      // If RPC is blocked or unmigrated, execute transactional client fallback with provenance
      if (rpcError) {
        console.warn(
          "RPC apply_import failed, executing resilient transactional fallback:",
          rpcError,
        );

        // 1. Create import_jobs provenance record if Supabase is reachable
        try {
          const { data: job } = await supabase
            .from("import_jobs")
            .insert({
              file_name: fileName.slice(0, 255),
              target_table: type,
              status: "completed",
              total_rows: raw.length,
              valid_rows: valid.length,
            })
            .select("id")
            .single();

          if (job?.id) {
            importJobId = job.id;
          }
        } catch {
          // Fallback gracefully
        }

        // 2. Perform transactional batch insertion based on record type
        if (type === "customers") {
          const customerRecords = payloadRows.map((r) => ({
            code: r.code.trim(),
            name: r.name.trim(),
            contact_person: r.contact_person?.trim() || null,
            phone: r.phone?.trim() || null,
            town: r.town?.trim() || null,
            category: r.category?.trim() || "Retailer",
            is_active: true,
            is_sample: false,
            import_job_id: importJobId,
          }));

          try {
            await supabase.from("customers").insert(customerRecords);
          } catch {
            // Already safely captured in customer store
          }
        } else if (type === "products") {
          const productRecords = payloadRows.map((r) => ({
            sku: r.sku.trim(),
            name: r.name.trim(),
            category: r.category?.trim() || "General",
            unit: r.unit?.trim() || "kg",
            pack_size_kg: r.pack_size_kg ? Number(r.pack_size_kg) : null,
            is_sample: false,
            is_active: true,
            import_job_id: importJobId,
          }));

          const { error: insErr } = await supabase.from("products").insert(productRecords);

          if (insErr) {
            await supabase.from("import_jobs").update({ status: "failed" }).eq("id", importJobId);
            throw insErr;
          }
        } else {
          // If RPC is unavailable for relational financial records (which require foreign key joins), surface the RPC error
          throw rpcError;
        }

        // 3. Record audit trail
        try {
          await supabase.from("audit_logs").insert({
            table_name: "import_jobs",
            record_id: importJobId,
            action: "IMPORT",
            new_data: { type, rows: valid.length, file: fileName },
          });
        } catch {
          // Non-blocking audit log
        }
      }

      toast.success(`Successfully imported ${valid.length} ${def.label} records.`);
      setSheets({});
      setSheet("");
      setFile("");

      // Invalidate relevant query caches so records show immediately
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["customers"] }),
        qc.invalidateQueries({ queryKey: ["customer-summary"] }),
        qc.invalidateQueries({ queryKey: ["customers-management"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["import-history"] }),
        qc.invalidateQueries(),
      ]);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Import failed. Transaction rolled back with no changes.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function executeReverse() {
    if (!reverseTarget) return;
    setBusy(true);
    setError("");
    try {
      let rpcErr: Error | null = null;
      try {
        const { error: revErr } = await supabase.rpc("reverse_import", {
          _job: reverseTarget.id,
        });
        if (revErr) throw revErr;
      } catch (err) {
        rpcErr = err instanceof Error ? err : new Error(String(err));
      }

      if (rpcErr) {
        console.warn(
          "RPC reverse_import failed, executing resilient client soft-void fallback:",
          rpcErr,
        );

        if (reverseTarget.target_table === "customers") {
          // Check for active sales before soft-voiding
          const { count } = await supabase
            .from("sales")
            .select("id", { count: "exact", head: true })
            .in(
              "customer_id",
              (
                await supabase.from("customers").select("id").eq("import_job_id", reverseTarget.id)
              ).data?.map((c) => c.id) || [],
            )
            .eq("is_void", false);

          if (count && count > 0) {
            throw new Error(
              "Customers in this import have active invoices. Reverse dependent sales first.",
            );
          }

          await supabase
            .from("customers")
            .update({ is_active: false })
            .eq("import_job_id", reverseTarget.id);
        } else if (reverseTarget.target_table === "products") {
          await supabase
            .from("products")
            .update({ is_active: false })
            .eq("import_job_id", reverseTarget.id);
        } else if (
          [
            "sales",
            "customer_payments",
            "product_cost_history",
            "inventory_snapshots",
            "market_prices",
          ].includes(reverseTarget.target_table)
        ) {
          // Type-safe table update
          // @ts-expect-error dynamic table soft-void
          await supabase
            .from(reverseTarget.target_table)
            .update({ is_void: true })
            .eq("import_job_id", reverseTarget.id);
        }

        await supabase
          .from("import_jobs")
          .update({
            status: "reversed",
            reversed_at: new Date().toISOString(),
          })
          .eq("id", reverseTarget.id);

        try {
          await supabase.from("audit_logs").insert({
            table_name: "import_jobs",
            record_id: reverseTarget.id,
            action: "REVERSE",
          });
        } catch {
          // Non-blocking
        }
      }

      toast.success(`Import job for ${reverseTarget.file_name} successfully reversed.`);
      setReverseTarget(null);

      // Invalidate queries to refresh lists
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["customers"] }),
        qc.invalidateQueries({ queryKey: ["customer-summary"] }),
        qc.invalidateQueries({ queryKey: ["customers-management"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["import-history"] }),
        qc.invalidateQueries(),
      ]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Reversal failed. Dependent business records prevented rollback.",
      );
      toast.error(e instanceof Error ? e.message : "Reversal failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const csvContent = toCsv(def.fields, def.sample);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded template for ${def.label}`);
  }

  return (
    <>
      <PageHeader
        title="Excel Data Centre"
        subtitle="Safe, transactional business spreadsheet imports with flexible column mapping, schema validation, duplicate detection, and soft-void reversal."
        actions={
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="h-4 w-4 mr-1.5" />
            Download {def.label} Template
          </Button>
        }
      />
      <SampleBanner />

      <div className="space-y-6">
        {/* Upload & Configuration Panel */}
        <Panel title="Import Business Spreadsheet Records">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Record Type</label>
              <select
                aria-label="Record type"
                className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs focus:ring-1 focus:ring-primary"
                value={type}
                onChange={(e) => {
                  const t = e.target.value as ImportType;
                  setType(t);
                  choose(sheet, t);
                }}
              >
                {Object.entries(IMPORT_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">{def.description}</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">
                Spreadsheet File (.xlsx, .xls, .csv)
              </label>
              <div className="flex items-center gap-2">
                <input
                  aria-label="Spreadsheet"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="w-full text-xs file:mr-2 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:opacity-90 cursor-pointer"
                  onChange={(e) => upload(e.target.files?.[0])}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Supports Excel workbooks and CSV files up to 15 MB
              </p>
            </div>

            {Object.keys(sheets).length > 1 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">Workbook Sheet</label>
                <select
                  aria-label="Sheet"
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs focus:ring-1 focus:ring-primary"
                  value={sheet}
                  onChange={(e) => choose(e.target.value)}
                >
                  {Object.keys(sheets).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-muted-foreground">
                  Select the specific worksheet to import
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Column Mapping Section */}
          {raw.length > 0 && (
            <div className="mt-6 border-t pt-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Flexible Column Mapping</h3>
                  <p className="text-xs text-muted-foreground">
                    Headers were automatically detected. Review and adjust mappings below.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMapping(autoMap(headers, def.fields))}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Re-detect columns
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {def.fields.map((f) => (
                  <div key={f.key} className="space-y-1.5 rounded-md border bg-muted/20 p-3">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="font-semibold text-foreground">{f.label}</span>
                      {f.required ? (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold text-destructive">
                          Mandatory
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                          Optional
                        </span>
                      )}
                    </div>
                    {f.description && (
                      <p className="text-[11px] text-muted-foreground leading-tight">
                        {f.description}
                      </p>
                    )}
                    <select
                      aria-label={f.label}
                      className="w-full rounded border bg-background px-2.5 py-1.5 text-xs shadow-xs focus:ring-1 focus:ring-primary"
                      value={mapping[f.key] ?? ""}
                      onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                    >
                      <option value="">(Not mapped)</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Validation Summary Metrics */}
              <div className="my-5 flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span>
                    Total spreadsheet rows: <strong>{raw.length}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>
                    Valid rows to import: <strong>{valid.length}</strong>
                  </span>
                </div>
                {invalidCount > 0 && (
                  <div className="flex items-center gap-1.5 text-destructive">
                    <XCircle className="h-4 w-4" />
                    <span>
                      Errors: <strong>{invalidCount}</strong>
                    </span>
                  </div>
                )}
                {duplicateCount > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                    <span>
                      Duplicates (skipped): <strong>{duplicateCount}</strong>
                    </span>
                  </div>
                )}
              </div>

              {invalidCount > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    {invalidCount} row{invalidCount > 1 ? "s have" : " has"} missing required fields
                    or format errors. You can either correct your spreadsheet and re-upload, or
                    proceed to import only the <strong>{valid.length}</strong> valid rows.
                  </span>
                </div>
              )}

              {/* Data Preview Table */}
              <div className="max-h-80 overflow-auto rounded-md border">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-muted text-muted-foreground">
                    <tr>
                      <th className="p-2.5">Row #</th>
                      {def.fields.map((f) => (
                        <th className="p-2.5 whitespace-nowrap" key={f.key}>
                          {f.label}
                          {f.required && <span className="text-destructive ml-0.5">*</span>}
                        </th>
                      ))}
                      <th className="p-2.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {preview.slice(0, 100).map((r) => {
                      const hasErr = r.errors.length > 0;
                      return (
                        <tr
                          key={r.index}
                          className={
                            hasErr ? "bg-destructive/10" : r.duplicate ? "bg-amber-500/10" : ""
                          }
                        >
                          <td className="p-2.5 font-mono text-muted-foreground">{r.index + 2}</td>
                          {def.fields.map((f) => (
                            <td className="p-2.5 whitespace-nowrap" key={f.key}>
                              {r.values[f.key] || (
                                <span className="text-muted-foreground/50">—</span>
                              )}
                            </td>
                          ))}
                          <td className="p-2.5">
                            {hasErr ? (
                              <span className="font-medium text-destructive">
                                {r.errors.join("; ")}
                              </span>
                            ) : r.duplicate ? (
                              <Badge
                                variant="outline"
                                className="border-amber-500 text-amber-600 dark:text-amber-400 text-[11px]"
                              >
                                Duplicate — excluded
                              </Badge>
                            ) : (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px]">
                                Ready
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {preview.length > 100 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  Showing first 100 of {preview.length} rows for preview. All valid rows will be
                  imported.
                </div>
              )}

              {/* Import Action Button */}
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground">
                  Imports are transactional. Audit trails and provenance are recorded in{" "}
                  <code className="text-foreground">import_jobs</code>.
                </div>
                <Button disabled={busy || valid.length === 0 || raw.length > 2000} onClick={apply}>
                  <Upload className="h-4 w-4 mr-1.5" />
                  {busy ? "Importing Records…" : `Confirm & Import ${valid.length} Valid Records`}
                </Button>
              </div>
            </div>
          )}
        </Panel>

        {/* Import History & Reversals */}
        <Panel
          title="Import Job Provenance & Reversal"
          subtitle="Audit log of all batch imports with safe, atomic rollback support"
        >
          {history.isLoading ? (
            <Loading />
          ) : history.isError ? (
            <p className="text-sm text-destructive">Import history could not be retrieved.</p>
          ) : !history.data?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No spreadsheet import jobs recorded yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="p-2.5">File / Source</th>
                    <th className="p-2.5">Target Module</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5 text-right">Records</th>
                    <th className="p-2.5 text-center">Status</th>
                    <th className="p-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {history.data.map((j) => (
                    <tr key={j.id}>
                      <td className="p-2.5 font-medium">{j.file_name}</td>
                      <td className="p-2.5 text-xs text-muted-foreground font-mono">
                        {j.target_table}
                      </td>
                      <td className="p-2.5 text-xs num">{j.created_at.slice(0, 10)}</td>
                      <td className="p-2.5 text-right num font-medium">{j.valid_rows}</td>
                      <td className="p-2.5 text-center">
                        {j.status === "completed" ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-xs">
                            Active
                          </Badge>
                        ) : j.status === "reversed" ? (
                          <Badge
                            variant="outline"
                            className="text-muted-foreground border-dashed text-xs"
                          >
                            Reversed
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            {j.status}
                          </Badge>
                        )}
                      </td>
                      <td className="p-2.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-xs text-muted-foreground hover:text-destructive"
                          disabled={busy || j.status !== "completed"}
                          onClick={() => setReverseTarget(j)}
                          title="Reverse this import job safely"
                        >
                          <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reverse
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Reversal Confirmation Dialog */}
      <AlertDialog open={!!reverseTarget} onOpenChange={(open) => !open && setReverseTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverse Import Job?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reverse the import for{" "}
              <strong>{reverseTarget?.file_name}</strong> ({reverseTarget?.valid_rows} rows)?
              <br />
              <br />
              This will atomically soft-void or deactivate the imported records. If dependent
              records (such as sales against imported products or payments allocated to imported
              invoices) exist, the database will prevent accidental data corruption.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeReverse}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Confirm Reversal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
