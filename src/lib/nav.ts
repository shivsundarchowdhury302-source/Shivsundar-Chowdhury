import { Users, UserCog, Wallet, Tags, Sparkles, FileSpreadsheet, Settings } from "lucide-react";
import type { AppRole } from "./auth";

export const NAV = [
  { to: "/customers", label: "Customers", icon: Users, roles: ["owner", "management", "staff"] },
  {
    to: "/customer-management",
    label: "Customer Management",
    icon: UserCog,
    roles: ["owner", "management"],
  },
  { to: "/credit", label: "Credit Management", icon: Wallet, roles: ["owner", "management"] },
  { to: "/pricing", label: "Pricing Intelligence", icon: Tags, roles: ["owner", "management"] },
  {
    to: "/assistant",
    label: "AI Business Assistant",
    icon: Sparkles,
    roles: ["owner", "management", "staff"],
  },
  {
    to: "/data-centre",
    label: "Excel Data Centre",
    icon: FileSpreadsheet,
    roles: ["owner", "management"],
  },
  { to: "/settings", label: "Settings", icon: Settings, roles: ["owner", "management", "staff"] },
] as const satisfies ReadonlyArray<{ to: string; label: string; icon: unknown; roles: AppRole[] }>;

export type NavPath = (typeof NAV)[number]["to"];

export function rolesFor(path: NavPath): readonly AppRole[] {
  return NAV.find((n) => n.to === path)?.roles ?? [];
}
