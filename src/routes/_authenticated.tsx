import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";
import { setDataSource, useDataSource } from "@/lib/data-source";
import { WorkspaceSelector } from "@/components/app/workspace-selector";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AppShell,
});

const roleLabel = { owner: "Owner", management: "Management", staff: "Staff" } as const;

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { role } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.filter((n) => role && (n.roles as readonly string[]).includes(role)).map((n) => {
        const active = path === n.to || path.startsWith(n.to + "/");
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent",
            )}
          >
            <n.icon className="h-4 w-4 text-sidebar-foreground" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2 px-3 font-display text-lg font-semibold">
      <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-sm text-primary-foreground">
        W
      </span>
      WholesaleIQ
    </Link>
  );
}

function AppShell() {
  const { session, role, user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const source = useDataSource();
  const qc = useQueryClient();

  const footer = (
    <div className="border-t border-sidebar-border px-3 pt-4">
      <div className="truncate text-sm font-medium">
        {user?.email || "owner@wholesaleiq.internal"}
      </div>
      <div className="mt-0.5 flex items-center justify-between">
        <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
          {role ? roleLabel[role] : "Owner"}
        </span>
        {session && (
          <Button variant="ghost" size="sm" onClick={signOut} className="text-sidebar-foreground">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col gap-5 border-r border-sidebar-border bg-sidebar py-5 lg:flex">
        <Brand />
        <WorkspaceSelector />
        <div className="flex-1 overflow-y-auto px-3">
          <SideNav />
        </div>
        {footer}
      </aside>

      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
        <Brand />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-72 flex-col gap-5 bg-sidebar py-5">
            <Brand />
            <WorkspaceSelector />
            <div className="flex-1 overflow-y-auto">
              <SideNav onNavigate={() => setOpen(false)} />
            </div>
            {footer}
          </SheetContent>
        </Sheet>
      </header>

      <main className="px-4 py-6 md:px-8 md:py-8 lg:ml-64">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-5 flex flex-wrap items-center justify-end gap-2 border-b pb-3">
            <span className="mr-auto text-xs text-muted-foreground">
              {source === "real" ? "Real business records" : "Demonstration records only"}
            </span>
            <Button
              variant={source === "real" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDataSource("real");
                qc.invalidateQueries();
              }}
            >
              Real data
            </Button>
            <Button
              variant={source === "demo" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setDataSource("demo");
                qc.invalidateQueries();
              }}
            >
              Demonstration
            </Button>
          </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
