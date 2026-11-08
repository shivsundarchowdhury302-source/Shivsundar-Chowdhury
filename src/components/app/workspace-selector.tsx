import { useState } from "react";
import { Building2, Plus, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useTenant } from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function WorkspaceSelector() {
  const { currentBusiness, businesses, switchBusiness, createBusiness } = useTenant();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bizName, setBizName] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!bizName.trim()) return;
    setBusy(true);
    try {
      await createBusiness(bizName.trim());
      toast.success(`Business workspace "${bizName.trim()}" created successfully!`);
      setBizName("");
      setDialogOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create business");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="px-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex w-full items-center justify-between rounded-lg border border-sidebar-border bg-sidebar-accent/50 px-2.5 py-2 text-left text-xs transition-colors hover:bg-sidebar-accent focus:outline-hidden"
              aria-label="Select business workspace"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="grid h-6 w-6 shrink-0 place-items-center rounded bg-primary text-[11px] font-bold text-primary-foreground">
                  {currentBusiness?.name?.charAt(0).toUpperCase() || "B"}
                </div>
                <div className="truncate">
                  <div className="truncate font-semibold text-sidebar-foreground">
                    {currentBusiness?.name || "Select Workspace"}
                  </div>
                  <div className="text-[10px] capitalize text-muted-foreground">
                    {currentBusiness?.role || "Staff"} Workspace
                  </div>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuLabel className="text-[11px] text-muted-foreground">
              Workspaces & Businesses
            </DropdownMenuLabel>
            {businesses.map((b) => (
              <DropdownMenuItem
                key={b.id}
                onClick={() => switchBusiness(b.id)}
                className="flex items-center justify-between text-xs cursor-pointer"
              >
                <div className="flex items-center gap-2 truncate">
                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{b.name}</span>
                </div>
                {b.id === currentBusiness?.id && (
                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDialogOpen(true)}
              className="text-xs text-primary font-medium cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Register New Business
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Register New Business</DialogTitle>
              <DialogDescription>
                Create an independent business workspace with its own customers, products, sales,
                payments, inventory, and team permissions.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <label className="grid gap-1.5 text-xs font-medium">
                Business Name
                <Input
                  required
                  placeholder="e.g. Apex Wholesale Commodities"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  maxLength={100}
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                You will automatically be assigned as the <strong>Owner</strong> of this business.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !bizName.trim()}>
                {busy ? "Registering…" : "Create Business"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
