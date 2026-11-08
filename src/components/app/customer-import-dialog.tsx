import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
} from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { IMPORT_TYPES, autoMap, validateRows, type RowResult } from "@/lib/import-validation";
import { bulkImportCustomers, seed40CustomersToStore } from "@/lib/customer-store";
import { useTenant } from "@/lib/tenant";

interface CustomerImportDialogProps {
  onSuccess?: () => void;
  triggerButton?: React.ReactNode;
}

export function CustomerImportDialog({ onSuccess, triggerButton }: CustomerImportDialogProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState<RowResult[]>([]);
  const qc = useQueryClient();
  const { activeBusiness } = useTenant();

  const customerDef = IMPORT_TYPES.customers;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setBusy(true);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result;
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          toast.error("The selected file contains no sheets.");
          setBusy(false);
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
          toast.error("Could not read sheet content.");
          setBusy(false);
          return;
        }

        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
          defval: "",
        });

        if (raw.length === 0) {
          toast.error("The spreadsheet is empty. Please add customer rows.");
          setBusy(false);
          return;
        }

        const headers = Object.keys(raw[0] ?? {});
        const mapping = autoMap(headers, customerDef.fields);

        // Validate rows and auto-fill missing codes
        const results = validateRows(
          raw,
          customerDef.fields,
          mapping,
          customerDef.dupKey,
          new Set(),
        );

        setParsedRows(results);
        toast.success(`Detected ${results.length} customer rows in "${file.name}".`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to parse spreadsheet file.");
      } finally {
        setBusy(false);
      }
    };

    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    const valid = parsedRows.filter((r) => r.errors.length === 0 && !r.duplicate);
    if (valid.length === 0) {
      toast.error("No valid customer records found to import.");
      return;
    }

    setBusy(true);
    try {
      const payloadRows = valid.map((r) => r.values);
      const res = await bulkImportCustomers(payloadRows, {
        businessId: activeBusiness?.id,
        fileName,
      });

      toast.success(
        `Added ${res.added} customer records directly into ${activeBusiness?.name || "your account"}.`,
      );

      // Invalidate queries so the customers show up immediately on all screens
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["customer-summary"] }),
        qc.invalidateQueries({ queryKey: ["customers-management"] }),
        qc.invalidateQueries({ queryKey: ["customers"] }),
        qc.invalidateQueries(),
      ]);

      setOpen(false);
      setParsedRows([]);
      setFileName("");
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to import customers.");
    } finally {
      setBusy(false);
    }
  }

  function handleDownloadTemplate() {
    const headers = [
      "Customer Code",
      "Customer Name",
      "Contact Person",
      "Mobile No",
      "City",
      "Category",
      "Credit Limit",
    ];
    const sampleRows = [
      [
        "CUST-001",
        "Maa Durga Traders",
        "Ramesh Ghosh",
        "+91 98300 11223",
        "Berhampore",
        "Retailer",
        "100000",
      ],
      [
        "CUST-002",
        "Bengal Sweet Hub",
        "Priya Sen",
        "+91 98300 44556",
        "Kolkata",
        "Sweet Shop",
        "150000",
      ],
      [
        "CUST-003",
        "Siliguri Grocery Mart",
        "Sunil Agarwal",
        "+91 98300 77889",
        "Siliguri",
        "Wholesaler",
        "200000",
      ],
    ];

    const ws = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, "wholesale_customers_template.xlsx");
    toast.success("Downloaded customer spreadsheet template.");
  }

  async function handleSeed40() {
    setBusy(true);
    try {
      const seeded = seed40CustomersToStore(activeBusiness?.id);
      toast.success(
        `Successfully loaded 40 realistic wholesale customer records into the interface!`,
      );
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["customer-summary"] }),
        qc.invalidateQueries({ queryKey: ["customers-management"] }),
        qc.invalidateQueries({ queryKey: ["customers"] }),
        qc.invalidateQueries(),
      ]);
      setOpen(false);
      onSuccess?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load sample customers.");
    } finally {
      setBusy(false);
    }
  }

  const validCount = parsedRows.filter((r) => r.errors.length === 0 && !r.duplicate).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" className="gap-1.5">
            <Upload className="h-4 w-4" /> Import Excel / CSV
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Import Customers into Interface</DialogTitle>
              <DialogDescription>
                Upload an Excel (.xlsx, .xls) or CSV sheet. Names, phone numbers, towns and details
                will be added directly into WholesaleIQ.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Dropzone */}
          <div className="relative border-2 border-dashed rounded-xl p-6 text-center hover:bg-muted/40 transition-colors">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={busy}
            />
            <div className="flex flex-col items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Upload className="h-5 w-5" />
              </div>
              <div className="font-medium text-sm">
                {fileName ? (
                  <span className="text-primary font-semibold">{fileName}</span>
                ) : (
                  "Drop customer spreadsheet here, or click to browse"
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Supports Microsoft Excel (.xlsx, .xls) and CSV files
              </p>
            </div>
          </div>

          {/* Quick Helper Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 rounded-lg text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>Need a spreadsheet or want to test immediately?</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleDownloadTemplate}
              >
                <Download className="h-3.5 w-3.5" /> Template
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="h-7 text-xs gap-1 font-medium text-primary hover:bg-primary/10"
                onClick={handleSeed40}
                disabled={busy}
              >
                <Sparkles className="h-3.5 w-3.5" /> Load 40 Customers
              </Button>
            </div>
          </div>

          {/* Parsed Rows Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-2 border rounded-lg p-3 bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Spreadsheet Preview</span>
                  <Badge
                    variant="outline"
                    className="gap-1 bg-emerald-50 text-emerald-700 border-emerald-200"
                  >
                    <CheckCircle2 className="h-3 w-3" /> {validCount} valid rows ready
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  Showing first {Math.min(5, parsedRows.length)} of {parsedRows.length} rows
                </span>
              </div>

              <div className="border rounded-md overflow-x-auto max-h-48 text-xs">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Customer Name</TableHead>
                      <TableHead>Contact Person</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Town</TableHead>
                      <TableHead>Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 5).map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-mono font-medium">
                          {row.values.code || `CUST-${(idx + 1).toString().padStart(4, "0")}`}
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {row.values.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.values.contact_person || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-muted-foreground">
                          {row.values.phone || "—"}
                        </TableCell>
                        <TableCell>{row.values.town || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">
                            {row.values.category || "Retailer"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {parsedRows.some((r) => r.errors.length > 0) && (
                <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>Rows with missing business names will be skipped automatically.</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={busy || validCount === 0} className="gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            {busy
              ? "Adding customers..."
              : `Add ${validCount} Customer${validCount === 1 ? "" : "s"} to Interface`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
