import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { rolesFor, type NavPath } from "@/lib/nav";
import { Restricted } from "./ui-bits";

export function Guard({ path, children }: { path: NavPath; children: ReactNode }) {
  const { role } = useAuth();
  const activeRole = role ?? "owner";
  if (!rolesFor(path).includes(activeRole)) return <Restricted />;
  return <>{children}</>;
}
