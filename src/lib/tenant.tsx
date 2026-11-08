import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type TenantRole = "owner" | "admin" | "staff" | "viewer";

export interface Business {
  id: string;
  name: string;
  role: TenantRole;
  createdAt?: string;
  settings?: Record<string, unknown>;
}

export interface TeamMember {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: TenantRole;
  status: "active" | "deactivated";
  createdAt: string;
}

interface TenantContextType {
  currentBusiness: Business | null;
  businesses: Business[];
  loading: boolean;
  switchBusiness: (businessId: string) => void;
  createBusiness: (name: string, settings?: Record<string, unknown>) => Promise<string>;
  refreshBusinesses: () => Promise<void>;
  isOwnerOrAdmin: boolean;
}

const DEFAULT_BUSINESS: Business = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "WholesaleIQ Primary",
  role: "owner",
};

const TenantContext = createContext<TenantContextType | null>(null);

const STORAGE_KEY = "wholesaleiq_active_business_id";

export function TenantProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [businesses, setBusinesses] = useState<Business[]>([DEFAULT_BUSINESS]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(DEFAULT_BUSINESS);
  const [loading, setLoading] = useState(false);

  async function loadUserBusinesses() {
    if (!user) {
      setBusinesses([DEFAULT_BUSINESS]);
      setCurrentBusiness(DEFAULT_BUSINESS);
      return;
    }

    setLoading(true);
    try {
      // Query memberships from database with fallback
      const { data, error } = await supabase
        .from("business_memberships")
        .select("role, businesses(id, name, settings, created_at)")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (error || !data || data.length === 0) {
        // Fallback to default enterprise workspace
        setBusinesses([DEFAULT_BUSINESS]);
        setCurrentBusiness(DEFAULT_BUSINESS);
      } else {
        const loaded: Business[] = data
          .filter((m) => m.businesses)
          .map((m) => {
            const b = m.businesses as unknown as {
              id: string;
              name: string;
              settings?: Record<string, unknown>;
              created_at?: string;
            };
            return {
              id: b.id,
              name: b.name,
              role: (m.role as TenantRole) || "staff",
              createdAt: b.created_at,
              settings: b.settings,
            };
          });

        if (loaded.length === 0) {
          loaded.push(DEFAULT_BUSINESS);
        }

        setBusinesses(loaded);

        const savedId = localStorage.getItem(STORAGE_KEY);
        const match = loaded.find((b) => b.id === savedId);
        setCurrentBusiness(match || loaded[0] || DEFAULT_BUSINESS);
      }
    } catch {
      setBusinesses([DEFAULT_BUSINESS]);
      setCurrentBusiness(DEFAULT_BUSINESS);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserBusinesses();
  }, [user?.id]);

  function switchBusiness(businessId: string) {
    const target = businesses.find((b) => b.id === businessId);
    if (target) {
      setCurrentBusiness(target);
      localStorage.setItem(STORAGE_KEY, target.id);
    }
  }

  async function createBusiness(
    name: string,
    settings: Record<string, unknown> = {},
  ): Promise<string> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Business name is required.");

    // Call RPC or insert into businesses
    let newId: string | null = null;
    try {
      const { data, error } = await supabase.rpc("create_new_business", {
        _name: trimmed,
        _settings: settings,
      });
      if (error) throw error;
      newId = data as string;
    } catch {
      // Direct insertion fallback
      const { data: bData, error: bErr } = await supabase
        .from("businesses")
        .insert({
          name: trimmed,
          settings,
          created_by: user?.id,
        })
        .select("id")
        .single();

      if (bErr) throw bErr;
      newId = bData.id;

      if (user?.id) {
        await supabase.from("business_memberships").insert({
          business_id: newId,
          user_id: user.id,
          role: "owner",
          status: "active",
        });
      }
    }

    const newBiz: Business = {
      id: newId || `biz-${Date.now()}`,
      name: trimmed,
      role: "owner",
      settings,
    };

    setBusinesses((prev) => [...prev, newBiz]);
    setCurrentBusiness(newBiz);
    localStorage.setItem(STORAGE_KEY, newBiz.id);
    return newBiz.id;
  }

  const isOwnerOrAdmin = currentBusiness?.role === "owner" || currentBusiness?.role === "admin";

  return (
    <TenantContext.Provider
      value={{
        currentBusiness,
        businesses,
        loading,
        switchBusiness,
        createBusiness,
        refreshBusinesses: loadUserBusinesses,
        isOwnerOrAdmin,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used within TenantProvider");
  return ctx;
}
