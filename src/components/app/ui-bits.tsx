import type { ReactNode } from "react";
import { FlaskConical, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDataSource } from "@/lib/data-source";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SampleBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-warning/40 bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-foreground",
        className,
      )}
    >
      <FlaskConical className="h-3 w-3" /> Sample data
    </span>
  );
}

export function SampleBanner() {
  const source = useDataSource();
  if (source !== "demo") return null;
  return (
    <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm">
      <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        <strong className="font-semibold">Demonstration figures.</strong> Customers, prices and
        transactions shown here are fictional sample records. Real imported records are excluded
        from this view.
      </p>
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  children,
  className,
  action,
}: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <section className={cn("rounded-xl border bg-card p-5 shadow-card", className)}>
      {(title || action) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "bad" | "warn";
}) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-card">
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          "num mt-2 text-xl font-semibold md:text-2xl",
          tone === "good" && "text-success",
          tone === "bad" && "text-destructive",
          tone === "warn" && "text-warning",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function Restricted({ what = "this section" }: { what?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-secondary px-6 py-16 text-center">
      <Lock className="h-6 w-6 text-muted-foreground" />
      <h2 className="mt-3 font-semibold">Restricted</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Your role does not have access to {what}. Ask the owner to update your permissions.
      </p>
    </div>
  );
}

export function Loading() {
  return <div className="py-16 text-center text-sm text-muted-foreground">Loading…</div>;
}

export function Tone({ value, children }: { value: number; children: ReactNode }) {
  return (
    <span className={cn("num", value < 0 ? "text-destructive" : value > 0 ? "text-success" : "")}>
      {children}
    </span>
  );
}
