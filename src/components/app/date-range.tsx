import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";
export type Range = { key: RangeKey; from: string; to: string };

const d = (x: Date) => format(x, "yyyy-MM-dd");

export function presetRange(key: Exclude<RangeKey, "custom">): Range {
  const today = new Date();
  const days = { today: 0, "7d": 6, "30d": 29, "90d": 89 }[key];
  return { key, from: d(subDays(today, days)), to: d(today) };
}

export function DateRangeFilter({
  value,
  onChange,
}: {
  value: Range;
  onChange: (r: Range) => void;
}) {
  const opts: { k: RangeKey; l: string }[] = [
    { k: "today", l: "Today" },
    { k: "7d", l: "7 days" },
    { k: "30d", l: "30 days" },
    { k: "90d", l: "90 days" },
    { k: "custom", l: "Custom" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border bg-secondary p-0.5">
        {opts.map((o) => (
          <button
            key={o.k}
            onClick={() =>
              onChange(o.k === "custom" ? { ...value, key: "custom" } : presetRange(o.k))
            }
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              value.key === o.k
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {o.l}
          </button>
        ))}
      </div>
      {value.key === "custom" && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            className="h-8 w-36 text-xs"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}
