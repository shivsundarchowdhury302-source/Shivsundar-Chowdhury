import { supabase } from "@/integrations/supabase/client";
import { setDataSource } from "./data-source";

export interface StoredCustomer {
  id: string;
  code: string;
  name: string;
  contact_person: string | null;
  phone: string | null;
  town: string | null;
  category: string;
  credit_limit: number;
  credit_days: number;
  outstanding: number;
  total_sales: number;
  gross_profit: number;
  invoice_count: number;
  last_purchase_date: string | null;
  is_active: boolean;
  is_sample: boolean;
  created_at: string;
  business_id?: string;
  import_job_id?: string | null;
}

const DEFAULT_WORKSPACE_ID = "00000000-0000-0000-0000-000000000001";

function getStorageKey(businessId?: string): string {
  const bId = businessId || DEFAULT_WORKSPACE_ID;
  return `wholesaleiq_custom_customers_${bId}`;
}

export function getLocalStoredCustomers(businessId?: string): StoredCustomer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getStorageKey(businessId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn("Failed to read local customer storage:", e);
    return [];
  }
}

export function saveLocalStoredCustomers(customers: StoredCustomer[], businessId?: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(getStorageKey(businessId), JSON.stringify(customers));
  } catch (e) {
    console.warn("Failed to write local customer storage:", e);
  }
}

/**
 * Add or update a customer record locally and attempt Supabase synchronization.
 */
export async function addOrUpdateStoredCustomer(
  customer: Partial<StoredCustomer> & { name: string },
  businessId?: string,
): Promise<StoredCustomer> {
  const current = getLocalStoredCustomers(businessId);
  const now = new Date().toISOString();
  const id = customer.id || crypto.randomUUID();
  const code = customer.code?.trim() || `CUST-${(current.length + 1).toString().padStart(4, "0")}`;

  const fullRecord: StoredCustomer = {
    id,
    code,
    name: customer.name.trim(),
    contact_person: customer.contact_person?.trim() || null,
    phone: customer.phone?.trim() || null,
    town: customer.town?.trim() || "Berhampore",
    category: customer.category?.trim() || "Retailer",
    credit_limit: Number(customer.credit_limit) || 100000,
    credit_days: Number(customer.credit_days) || 15,
    outstanding: Number(customer.outstanding) || 0,
    total_sales: Number(customer.total_sales) || 0,
    gross_profit: Number(customer.gross_profit) || 0,
    invoice_count: Number(customer.invoice_count) || 0,
    last_purchase_date: customer.last_purchase_date || null,
    is_active: customer.is_active !== false,
    is_sample: Boolean(customer.is_sample),
    created_at: customer.created_at || now,
    business_id: businessId || DEFAULT_WORKSPACE_ID,
    import_job_id: customer.import_job_id || null,
  };

  const existingIdx = current.findIndex(
    (c) => c.id === id || c.code.toLowerCase() === code.toLowerCase(),
  );
  if (existingIdx >= 0) {
    current[existingIdx] = { ...current[existingIdx], ...fullRecord };
  } else {
    current.unshift(fullRecord);
  }

  saveLocalStoredCustomers(current, businessId);

  // Background attempt to persist in Supabase if online
  try {
    await supabase.from("customers").upsert(
      {
        id: fullRecord.id,
        code: fullRecord.code,
        name: fullRecord.name,
        contact_person: fullRecord.contact_person,
        phone: fullRecord.phone,
        town: fullRecord.town,
        category: fullRecord.category,
        is_active: fullRecord.is_active,
        is_sample: fullRecord.is_sample,
        business_id: fullRecord.business_id,
      },
      { onConflict: "code" },
    );
  } catch {
    // Non-blocking fallback
  }

  return fullRecord;
}

/**
 * Bulk import customer records.
 * Automatically saves to local persistent store, triggers Supabase import,
 * and activates "real" data source mode so customers are immediately visible.
 */
export async function bulkImportCustomers(
  rows: Record<string, string>[],
  options?: {
    businessId?: string;
    fileName?: string;
    isSample?: boolean;
  },
): Promise<{ added: number; total: number; customers: StoredCustomer[] }> {
  const businessId = options?.businessId || DEFAULT_WORKSPACE_ID;
  const current = getLocalStoredCustomers(businessId);
  const now = new Date().toISOString();
  const importJobId = crypto.randomUUID();

  const newCustomers: StoredCustomer[] = [];
  const existingCodes = new Set(current.map((c) => c.code.toLowerCase()));

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const name = (r.name || r["Customer Name"] || r["Name"] || "").trim();
    if (!name) continue;

    let code = (r.code || r["Customer Code"] || r["Code"] || "").trim();
    if (!code || existingCodes.has(code.toLowerCase())) {
      code = `CUST-${(current.length + newCustomers.length + 1).toString().padStart(4, "0")}`;
    }
    existingCodes.add(code.toLowerCase());

    const cust: StoredCustomer = {
      id: crypto.randomUUID(),
      code,
      name,
      contact_person: (r.contact_person || r["Contact Person"] || "").trim() || null,
      phone: (r.phone || r["Mobile No"] || r["Phone"] || "").trim() || null,
      town: (r.town || r["City"] || r["Town"] || "Berhampore").trim(),
      category: (r.category || r["Category"] || "Retailer").trim(),
      credit_limit: Number(r.credit_limit || r["Credit Limit"]) || 100000,
      credit_days: Number(r.credit_days || r["Credit Days"]) || 15,
      outstanding: 0,
      total_sales: 0,
      gross_profit: 0,
      invoice_count: 0,
      last_purchase_date: null,
      is_active: true,
      is_sample: Boolean(options?.isSample),
      created_at: now,
      business_id: businessId,
      import_job_id: importJobId,
    };

    newCustomers.push(cust);
  }

  // Merge into local persistent storage
  const merged = [...newCustomers, ...current];
  saveLocalStoredCustomers(merged, businessId);

  // Automatically activate Real Data mode so imported customers show up immediately
  setDataSource("real");

  // Attempt Supabase insert in background
  try {
    const dbPayload = newCustomers.map((c) => ({
      id: c.id,
      code: c.code,
      name: c.name,
      contact_person: c.contact_person,
      phone: c.phone,
      town: c.town,
      category: c.category,
      is_active: true,
      is_sample: c.is_sample,
      business_id: businessId,
      import_job_id: importJobId,
    }));
    await supabase.from("customers").insert(dbPayload);
  } catch {
    // Non-blocking resilient fallback
  }

  return {
    added: newCustomers.length,
    total: merged.length,
    customers: merged,
  };
}

/**
 * Pre-configured 40 wholesale customer accounts for instant 1-click verification.
 */
export function getSample40WholesaleCustomers(businessId?: string): StoredCustomer[] {
  const cities = [
    "Berhampore",
    "Kolkata",
    "Siliguri",
    "Asansol",
    "Durgapur",
    "Lalbagh",
    "Jiaganj",
    "Malda",
  ];
  const categories = [
    "Retailer",
    "Wholesaler",
    "Sweet Shop",
    "Bakery",
    "Supermarket",
    "Hotel / Restaurant",
  ];
  const bId = businessId || DEFAULT_WORKSPACE_ID;
  const now = new Date().toISOString();

  return Array.from({ length: 40 }, (_, i) => {
    const num = (i + 1).toString().padStart(3, "0");
    const city = cities[i % cities.length]!;
    const category = categories[i % categories.length]!;
    const limit = (i + 1) * 25000 + 50000;

    return {
      id: `40000000-0000-0000-0000-${(i + 1).toString().padStart(12, "0")}`,
      code: `CUST-${num}`,
      name: `Wholesale Enterprise ${num} (${city})`,
      contact_person: i % 2 === 0 ? `Manager ${num}` : `Proprietor ${num}`,
      phone: `+91 98300 ${num.padStart(5, "0")}`,
      town: city,
      category,
      credit_limit: limit,
      credit_days: 15 + (i % 3) * 7,
      outstanding: i % 4 === 0 ? 35000 + i * 1500 : 0,
      total_sales: (i + 1) * 45000,
      gross_profit: Math.round((i + 1) * 45000 * 0.12),
      invoice_count: 2 + (i % 5),
      last_purchase_date: new Date(Date.now() - (i % 15) * 86400000).toISOString().slice(0, 10),
      is_active: true,
      is_sample: false,
      created_at: now,
      business_id: bId,
      import_job_id: "sample-40-seed",
    };
  });
}

/**
 * Seed 40 sample customer accounts into the active workspace.
 */
export function seed40CustomersToStore(businessId?: string): StoredCustomer[] {
  const samples = getSample40WholesaleCustomers(businessId);
  const current = getLocalStoredCustomers(businessId);
  const existingCodes = new Set(current.map((c) => c.code.toLowerCase()));

  const added = samples.filter((s) => !existingCodes.has(s.code.toLowerCase()));
  const merged = [...added, ...current];
  saveLocalStoredCustomers(merged, businessId);

  // Automatically activate Real Data mode so the 40 customers show up immediately
  setDataSource("real");
  return merged;
}
