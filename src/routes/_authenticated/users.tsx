import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { UserPlus, Shield, UserX, Check, AlertCircle, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Guard } from "@/components/app/guard";
import { PageHeader, Panel } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { pageHead } from "@/lib/page-head";
import { useTenant, type TenantRole } from "@/lib/tenant";

export const Route = createFileRoute("/_authenticated/users")({
  head: () =>
    pageHead("User Management", "Multi-tenant team management and role-based permissions."),
  component: () => (
    <Guard path="/users">
      <Users />
    </Guard>
  ),
});

interface MemberItem {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  role: TenantRole;
  status: "active" | "deactivated";
}

function Users() {
  const qc = useQueryClient();
  const { currentBusiness, isOwnerOrAdmin } = useTenant();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TenantRole>("staff");

  const team = useQuery({
    queryKey: ["team-members", currentBusiness?.id],
    queryFn: async (): Promise<MemberItem[]> => {
      // 1. Query business memberships
      const { data: mems, error: memErr } = await supabase
        .from("business_memberships")
        .select("id, user_id, role, status")
        .eq("business_id", currentBusiness?.id || "00000000-0000-0000-0000-000000000001");

      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email");

      if (mems && mems.length > 0) {
        return mems.map((m) => {
          const prof = profiles?.find((p) => p.id === m.user_id);
          return {
            id: m.id,
            user_id: m.user_id,
            email: prof?.email || "team-member@wholesaleiq.internal",
            full_name: prof?.full_name || "Team Member",
            role: (m.role as TenantRole) || "staff",
            status: (m.status as "active" | "deactivated") || "active",
          };
        });
      }

      // Fallback: If no business_memberships records exist yet, load legacy profiles with roles
      const { data: legacyRoles } = await supabase.from("user_roles").select("*");
      return (profiles ?? []).map((p) => {
        const r = legacyRoles?.find((x) => x.user_id === p.id);
        const mappedRole: TenantRole =
          r?.role === "owner" ? "owner" : r?.role === "management" ? "admin" : "staff";
        return {
          id: p.id,
          user_id: p.id,
          email: p.email || "",
          full_name: p.full_name || "Team Member",
          role: mappedRole,
          status: "active" as const,
        };
      });
    },
  });

  async function handleRoleChange(userId: string, newRole: TenantRole) {
    const currentMember = team.data?.find((m) => m.user_id === userId);
    if (!currentMember) return;

    // Last Owner Protection check
    if (currentMember.role === "owner" && newRole !== "owner") {
      const activeOwners =
        team.data?.filter((m) => m.role === "owner" && m.status === "active") || [];
      if (activeOwners.length <= 1) {
        toast.error("Action blocked: A business must retain at least one active Owner.");
        return;
      }
    }

    setBusy(true);
    setError("");
    try {
      // 1. Try update_membership_role RPC
      const { error: rpcErr } = await supabase.rpc("update_membership_role", {
        _business_id: currentBusiness?.id || "00000000-0000-0000-0000-000000000001",
        _target_user: userId,
        _new_role: newRole,
      });

      if (rpcErr) {
        // Direct table update fallback
        await supabase
          .from("business_memberships")
          .update({ role: newRole })
          .eq("user_id", userId)
          .eq("business_id", currentBusiness?.id || "00000000-0000-0000-0000-000000000001");
      }

      toast.success(`Role updated to ${newRole}`);
      await qc.invalidateQueries({ queryKey: ["team-members"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to update role";
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleStatus(userId: string, currentStatus: "active" | "deactivated") {
    const newStatus = currentStatus === "active" ? "deactivated" : "active";
    const currentMember = team.data?.find((m) => m.user_id === userId);

    if (currentMember?.role === "owner" && newStatus === "deactivated") {
      const activeOwners =
        team.data?.filter((m) => m.role === "owner" && m.status === "active") || [];
      if (activeOwners.length <= 1) {
        toast.error("Action blocked: Cannot deactivate the last remaining Owner.");
        return;
      }
    }

    setBusy(true);
    try {
      await supabase
        .from("business_memberships")
        .update({ status: newStatus })
        .eq("user_id", userId)
        .eq("business_id", currentBusiness?.id || "00000000-0000-0000-0000-000000000001");

      toast.success(`Member ${newStatus === "active" ? "activated" : "deactivated"}`);
      await qc.invalidateQueries({ queryKey: ["team-members"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setBusy(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setBusy(true);
    try {
      // Record invitation in database
      await supabase.from("invitations").insert({
        business_id: currentBusiness?.id || "00000000-0000-0000-0000-000000000001",
        email: inviteEmail.trim().toLowerCase(),
        role: inviteRole,
        status: "pending",
      });

      toast.success(`Invitation sent to ${inviteEmail.trim()} as ${inviteRole}`);
      setInviteEmail("");
      setInviteOpen(false);
      await qc.invalidateQueries({ queryKey: ["team-members"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Team Management"
        subtitle={`Manage user roles and operational permissions for ${currentBusiness?.name || "your business"}.`}
        actions={
          isOwnerOrAdmin ? (
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Invite Team Member
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        <Panel
          title="Business Members"
          subtitle="Role hierarchy: Owner (Full control), Admin (Team & Business control), Staff (Operational), Viewer (Read-only)"
        >
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {team.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading team members…</p>
          ) : team.isError ? (
            <p className="py-6 text-center text-sm text-destructive">
              Failed to load team members.
            </p>
          ) : (
            <div className="divide-y">
              {team.data?.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground">{m.full_name}</p>
                      {m.status === "deactivated" ? (
                        <Badge
                          variant="outline"
                          className="border-destructive text-destructive text-[10px]"
                        >
                          Deactivated
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="capitalize text-[10px]">
                          {m.role}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwnerOrAdmin && (
                      <>
                        <select
                          aria-label={`Role for ${m.full_name}`}
                          className="rounded-md border bg-background px-2.5 py-1 text-xs shadow-xs focus:ring-1 focus:ring-primary"
                          disabled={busy || m.status === "deactivated"}
                          value={m.role}
                          onChange={(e) =>
                            handleRoleChange(m.user_id, e.target.value as TenantRole)
                          }
                        >
                          <option value="owner">Owner (Full control)</option>
                          <option value="admin">Admin (Team & Settings)</option>
                          <option value="staff">Staff (Operational)</option>
                          <option value="viewer">Viewer (Read-only)</option>
                        </select>

                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() => handleToggleStatus(m.user_id, m.status)}
                          className={
                            m.status === "active"
                              ? "text-destructive hover:bg-destructive/10"
                              : "text-emerald-600 hover:bg-emerald-50"
                          }
                          title={
                            m.status === "active" ? "Deactivate member access" : "Reactivate member"
                          }
                        >
                          {m.status === "active" ? (
                            <>
                              <UserX className="h-3.5 w-3.5 mr-1" /> Deactivate
                            </>
                          ) : (
                            <>
                              <Check className="h-3.5 w-3.5 mr-1" /> Activate
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Invite Member Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <form onSubmit={handleInvite}>
            <DialogHeader>
              <DialogTitle>Invite Employee to {currentBusiness?.name}</DialogTitle>
              <DialogDescription>
                Send an invitation to grant access to this business workspace.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-4">
              <label className="grid gap-1.5 text-xs font-medium">
                Email Address
                <Input
                  type="email"
                  required
                  placeholder="employee@wholesale.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </label>

              <label className="grid gap-1.5 text-xs font-medium">
                Assigned Role
                <select
                  className="rounded-md border bg-background px-2.5 py-2 text-xs shadow-xs"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as TenantRole)}
                >
                  <option value="owner">Owner — Full control and billing management</option>
                  <option value="admin">Admin — Manage team and business settings</option>
                  <option value="staff">
                    Staff — Daily sales, credit and inventory operations
                  </option>
                  <option value="viewer">Viewer — Read-only access to analytics and reports</option>
                </select>
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !inviteEmail.trim()}>
                <Mail className="h-3.5 w-3.5 mr-1.5" />
                {busy ? "Sending…" : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
