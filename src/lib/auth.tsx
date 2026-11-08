import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "management" | "staff";

type AuthState = {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  loading: boolean;
  isFinance: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const rank: Record<AppRole, number> = { owner: 3, management: 2, staff: 1 };

const DEFAULT_USER: User = {
  id: "00000000-0000-0000-0000-000000000001",
  app_metadata: {},
  user_metadata: { full_name: "Wholesale Owner" },
  aud: "authenticated",
  created_at: "2026-01-01T00:00:00.000Z",
  email: "owner@wholesaleiq.internal",
  phone: "",
  role: "authenticated",
  updated_at: "2026-01-01T00:00:00.000Z",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole>("owner");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) setRole("owner");
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const sessionUserId = session?.user?.id;
  useEffect(() => {
    if (!sessionUserId) return;
    let cancelled = false;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", sessionUserId)
      .then(({ data }) => {
        if (cancelled) return;
        const roles = (data ?? []).map((r) => r.role as AppRole);
        const best = roles.sort((a, b) => rank[b] - rank[a])[0] ?? "owner";
        setRole(best);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionUserId]);

  const value: AuthState = {
    session,
    user: session?.user ?? DEFAULT_USER,
    role: role || "owner",
    loading,
    isFinance: true,
    signOut: async () => {
      await supabase.auth.signOut();
      setSession(null);
      setRole("owner");
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function canAccess(role: AppRole | null, allowed: AppRole[]) {
  return !!role && allowed.includes(role);
}
