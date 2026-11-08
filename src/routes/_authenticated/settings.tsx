import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/_authenticated/settings")({
  head: () => pageHead("Settings", "WholesaleIQ account profile and current access."),
  component: Settings,
});
function Settings() {
  const { user, role } = useAuth();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const userId = user?.id;
  useEffect(() => {
    if (userId)
      supabase
        .from("profiles")
        .select("full_name")
        .eq("id", userId)
        .single()
        .then(({ data }) => setName(data?.full_name ?? ""));
  }, [userId]);
  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() })
      .eq("id", user.id);
    if (error) toast.error("Profile could not be saved");
    else toast.success("Profile saved");
    setBusy(false);
  }
  return (
    <>
      <PageHeader title="Settings" />
      <Panel title="Your account">
        <div className="max-w-lg space-y-4">
          <label className="grid gap-2 text-sm">
            Name
            <Input
              aria-label="Profile name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
            />
          </label>
          <p className="text-sm">{user?.email}</p>
          <p className="text-sm text-muted-foreground">Access: {role}</p>
          <Button disabled={busy || !name.trim()} onClick={save}>
            <Save className="h-4 w-4" />
            Save profile
          </Button>
        </div>
      </Panel>
    </>
  );
}
