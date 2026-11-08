export type FieldType = "text" | "number" | "date" | "phone";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  min?: number;
  description?: string;
  aliases?: string[];
};

export type ImportType =
  | "customers"
  | "products"
  | "sales"
  | "customer_payments"
  | "product_cost_history"
  | "inventory_snapshots"
  | "market_prices"
  | "customer_price_history";

export const IMPORT_TYPES: Record<
  ImportType,
  {
    label: string;
    description: string;
    fields: FieldDef[];
    dupKey: string[];
    sample: Record<string, string>;
  }
> = {
  customers: {
    label: "Customers",
    description: "Customer accounts, contact persons, phone numbers, and categories.",
    fields: [
      {
        key: "code",
        label: "Customer Code",
        type: "text",
        required: true,
        description: "Unique customer identifier (e.g. C101)",
        aliases: [
          "customer code",
          "code",
          "customer id",
          "cust code",
          "party code",
          "account id",
          "id",
          "client id",
        ],
      },
      {
        key: "name",
        label: "Customer Name",
        type: "text",
        required: true,
        description: "Official trading or business name",
        aliases: [
          "customer name",
          "business name",
          "party name",
          "name",
          "company name",
          "client name",
          "firm",
          "store name",
          "shop name",
        ],
      },
      {
        key: "contact_person",
        label: "Contact Person",
        type: "text",
        required: false,
        description: "Primary buyer or account manager name",
        aliases: [
          "contact person",
          "contact",
          "contact name",
          "person",
          "owner",
          "proprietor",
          "manager",
        ],
      },
      {
        key: "phone",
        label: "Phone",
        type: "phone",
        required: false,
        description: "Mobile or telephone number",
        aliases: [
          "phone",
          "mobile",
          "mobile number",
          "phone number",
          "contact number",
          "contact no",
          "telephone",
          "cell",
          "tel",
        ],
      },
      {
        key: "town",
        label: "Town / City",
        type: "text",
        required: false,
        description: "Town, market locality, or delivery area",
        aliases: ["town", "city", "location", "area", "address", "market", "place", "district"],
      },
      {
        key: "category",
        label: "Category",
        type: "text",
        required: false,
        description: "Customer segment (e.g. Retailer, Supermarket, Wholesaler)",
        aliases: [
          "category",
          "customer category",
          "type",
          "customer type",
          "segment",
          "classification",
          "group",
        ],
      },
    ],
    dupKey: ["code"],
    sample: {
      code: "C101",
      name: "Sunrise Grocers",
      contact_person: "Rajesh Sharma",
      phone: "+91 98301 23456",
      town: "Kolkata",
      category: "Retailer",
    },
  },

  products: {
    label: "Products",
    description: "Inventory SKU catalogue, names, categories, and standard packaging sizes.",
    fields: [
      {
        key: "sku",
        label: "Product SKU",
        type: "text",
        required: true,
        description: "Unique item code (e.g. SUG-50)",
        aliases: ["sku", "product sku", "item code", "product code", "code", "item id"],
      },
      {
        key: "name",
        label: "Product Name",
        type: "text",
        required: true,
        description: "Standard item description",
        aliases: ["product name", "item name", "description", "name", "product", "item"],
      },
      {
        key: "category",
        label: "Category",
        type: "text",
        required: false,
        description: "Product family or category",
        aliases: ["category", "product category", "group", "item group", "type"],
      },
      {
        key: "unit",
        label: "Unit of Measure",
        type: "text",
        required: false,
        description: "Unit (e.g. kg, bag, tin)",
        aliases: ["unit", "uom", "unit of measure", "measurement unit"],
      },
      {
        key: "pack_size_kg",
        label: "Pack Size (kg)",
        type: "number",
        required: false,
        min: 0.01,
        description: "Net weight per package in kg",
        aliases: [
          "pack size",
          "pack size kg",
          "pack size (kg)",
          "package size",
          "weight",
          "weight kg",
        ],
      },
    ],
    dupKey: ["sku"],
    sample: {
      sku: "SUG-50",
      name: "Refined White Sugar 50kg",
      category: "Commodities",
      unit: "kg",
      pack_size_kg: "50",
    },
  },

  sales: {
    label: "Sales & Invoices",
    description: "Invoice transactions, lines, selling rates, and landed costs.",
    fields: [
      {
        key: "invoice_no",
        label: "Invoice Number",
        type: "text",
        required: true,
        description: "Invoice or bill reference number",
        aliases: [
          "invoice no",
          "invoice number",
          "bill no",
          "bill number",
          "inv no",
          "invoice",
          "bill",
        ],
      },
      {
        key: "customer_code",
        label: "Customer Code",
        type: "text",
        required: true,
        description: "Code of existing customer",
        aliases: [
          "customer code",
          "cust code",
          "customer id",
          "party code",
          "customer",
          "client code",
        ],
      },
      {
        key: "sku",
        label: "Product SKU",
        type: "text",
        required: true,
        description: "SKU of existing product",
        aliases: ["product sku", "sku", "item code", "product code", "item"],
      },
      {
        key: "sale_date",
        label: "Sale Date",
        type: "date",
        required: true,
        description: "Date of sale (YYYY-MM-DD)",
        aliases: ["sale date", "invoice date", "bill date", "date", "tx date"],
      },
      {
        key: "due_date",
        label: "Due Date",
        type: "date",
        required: true,
        description: "Payment due date (YYYY-MM-DD)",
        aliases: ["due date", "payment due date", "due on", "agreed due date", "credit due date"],
      },
      {
        key: "quantity_kg",
        label: "Quantity (kg)",
        type: "number",
        required: true,
        min: 0.01,
        description: "Volume sold in kg",
        aliases: ["quantity", "quantity kg", "quantity (kg)", "qty", "qty kg", "volume"],
      },
      {
        key: "unit_price",
        label: "Selling Price / kg",
        type: "number",
        required: true,
        min: 0.01,
        description: "Rate per kg billed to customer",
        aliases: [
          "unit price",
          "selling price",
          "rate",
          "price",
          "sale price",
          "selling rate",
          "price per kg",
        ],
      },
      {
        key: "unit_cost",
        label: "Landed Cost / kg",
        type: "number",
        required: true,
        min: 0.01,
        description: "Acquisition landed cost per kg",
        aliases: [
          "unit cost",
          "landed cost",
          "cost price",
          "cost",
          "cost per kg",
          "acquisition cost",
        ],
      },
      {
        key: "payment_type",
        label: "Payment Type",
        type: "text",
        required: true,
        description: "credit or cash",
        aliases: ["payment type", "terms", "type", "mode", "credit cash", "payment term"],
      },
    ],
    dupKey: ["invoice_no", "sku"],
    sample: {
      invoice_no: "INV-2026-001",
      customer_code: "C101",
      sku: "SUG-50",
      sale_date: "2026-11-01",
      due_date: "2026-11-16",
      quantity_kg: "100",
      unit_price: "44.50",
      unit_cost: "39.20",
      payment_type: "credit",
    },
  },

  customer_payments: {
    label: "Payments",
    description: "Customer payment receipts with optional credit invoice allocations.",
    fields: [
      {
        key: "customer_code",
        label: "Customer Code",
        type: "text",
        required: true,
        description: "Customer identifier",
        aliases: [
          "customer code",
          "cust code",
          "customer id",
          "party code",
          "customer",
          "client code",
        ],
      },
      {
        key: "payment_date",
        label: "Payment Date",
        type: "date",
        required: true,
        description: "Date of receipt (YYYY-MM-DD)",
        aliases: ["payment date", "date", "receipt date", "txn date", "deposit date"],
      },
      {
        key: "amount",
        label: "Amount (₹)",
        type: "number",
        required: true,
        min: 0.01,
        description: "Payment amount in ₹",
        aliases: ["amount", "amount paid", "paid", "amount (₹)", "total paid", "receipt amount"],
      },
      {
        key: "method",
        label: "Method",
        type: "text",
        required: false,
        description: "UPI, NEFT, Cheque, RTGS, or Cash",
        aliases: ["method", "payment method", "mode", "payment mode", "channel"],
      },
      {
        key: "reference",
        label: "Reference / UTR",
        type: "text",
        required: true,
        description: "Unique transaction identifier or cheque number",
        aliases: [
          "reference",
          "reference no",
          "utr",
          "txn id",
          "transaction id",
          "cheque no",
          "ref no",
        ],
      },
      {
        key: "invoice_no",
        label: "Allocated Invoice (Optional)",
        type: "text",
        required: false,
        description: "Credit invoice number this payment settles (optional)",
        aliases: [
          "invoice no",
          "allocated invoice",
          "bill no",
          "credit invoice",
          "settling invoice",
          "against bill",
        ],
      },
    ],
    dupKey: ["reference"],
    sample: {
      customer_code: "C101",
      payment_date: "2026-11-05",
      amount: "4450",
      method: "NEFT",
      reference: "UTR987654321",
      invoice_no: "INV-2026-001",
    },
  },

  product_cost_history: {
    label: "Landed Costs",
    description: "Purchase landed costs per kg including freight and handling.",
    fields: [
      {
        key: "sku",
        label: "Product SKU",
        type: "text",
        required: true,
        description: "Product identifier",
        aliases: ["product sku", "sku", "item code", "product code", "item"],
      },
      {
        key: "effective_date",
        label: "Effective Date",
        type: "date",
        required: true,
        description: "Date landed cost applies from (YYYY-MM-DD)",
        aliases: ["effective date", "date", "cost date", "as of date"],
      },
      {
        key: "landed_cost",
        label: "Landed Cost / kg",
        type: "number",
        required: true,
        min: 0.01,
        description: "Total landed cost per kg",
        aliases: [
          "landed cost",
          "cost",
          "landed cost per kg",
          "cost per kg",
          "purchase price",
          "acquisition cost",
        ],
      },
      {
        key: "source",
        label: "Source / Supplier",
        type: "text",
        required: false,
        description: "Mill, supplier, or purchase bill reference",
        aliases: ["source", "supplier", "vendor", "mill", "purchase invoice", "supplier name"],
      },
    ],
    dupKey: ["sku", "effective_date"],
    sample: {
      sku: "SUG-50",
      effective_date: "2026-11-01",
      landed_cost: "39.20",
      source: "Renuka Sugars Mill Gate",
    },
  },

  inventory_snapshots: {
    label: "Inventory",
    description: "Warehouse stock quantities and acquisition valuation.",
    fields: [
      {
        key: "sku",
        label: "Product SKU",
        type: "text",
        required: true,
        description: "Product identifier",
        aliases: ["product sku", "sku", "item code", "product code", "item"],
      },
      {
        key: "godown",
        label: "Godown / Warehouse",
        type: "text",
        required: true,
        description: "Godown or warehouse facility name",
        aliases: ["godown", "warehouse", "location", "facility", "store", "depot", "branch"],
      },
      {
        key: "snapshot_date",
        label: "Snapshot Date",
        type: "date",
        required: true,
        description: "Stock take date (YYYY-MM-DD)",
        aliases: ["snapshot date", "date", "stock date", "as of date", "inventory date"],
      },
      {
        key: "quantity_kg",
        label: "Stock Quantity (kg)",
        type: "number",
        required: true,
        min: 0,
        description: "Available stock in kg",
        aliases: [
          "stock quantity",
          "quantity",
          "quantity kg",
          "quantity (kg)",
          "qty",
          "qty kg",
          "in stock",
        ],
      },
      {
        key: "avg_cost",
        label: "Average Cost / kg",
        type: "number",
        required: true,
        min: 0,
        description: "Weighted average stock valuation per kg",
        aliases: [
          "average cost",
          "avg cost",
          "unit cost",
          "cost per kg",
          "valuation per kg",
          "cost",
        ],
      },
    ],
    dupKey: ["sku", "godown", "snapshot_date"],
    sample: {
      sku: "SUG-50",
      godown: "Main Godown A",
      snapshot_date: "2026-11-01",
      quantity_kg: "25000",
      avg_cost: "39.10",
    },
  },

  market_prices: {
    label: "Competitor Prices",
    description: "Competitor and mandi quotes for competitive margin intelligence.",
    fields: [
      {
        key: "sku",
        label: "Product SKU",
        type: "text",
        required: true,
        description: "Product identifier",
        aliases: ["product sku", "sku", "item code", "product code", "item"],
      },
      {
        key: "price_date",
        label: "Price Date",
        type: "date",
        required: true,
        description: "Date of market observation (YYYY-MM-DD)",
        aliases: ["price date", "date", "quote date", "observation date"],
      },
      {
        key: "source_type",
        label: "Source Type (competitor/market)",
        type: "text",
        required: true,
        description: "competitor or market",
        aliases: ["source type", "type", "market / competitor", "quote type"],
      },
      {
        key: "source_name",
        label: "Competitor / Source Name",
        type: "text",
        required: false,
        description: "Competitor wholesaler name or Mandi name",
        aliases: [
          "source name",
          "competitor name",
          "competitor",
          "mandi name",
          "market name",
          "source",
        ],
      },
      {
        key: "price",
        label: "Price / kg",
        type: "number",
        required: true,
        min: 0.01,
        description: "Quoted market rate per kg",
        aliases: [
          "price",
          "price per kg",
          "competitor price",
          "market price",
          "rate",
          "quote price",
        ],
      },
    ],
    dupKey: ["sku", "price_date", "source_name"],
    sample: {
      sku: "SUG-50",
      price_date: "2026-11-01",
      source_type: "competitor",
      source_name: "Apex Wholesalers",
      price: "43.75",
    },
  },

  customer_price_history: {
    label: "Customer Selling Prices",
    description: "Customer-specific agreed selling price agreements.",
    fields: [
      {
        key: "customer_code",
        label: "Customer Code",
        type: "text",
        required: true,
        description: "Customer identifier",
        aliases: ["customer code", "cust code", "customer id", "party code", "customer"],
      },
      {
        key: "sku",
        label: "Product SKU",
        type: "text",
        required: true,
        description: "Product identifier",
        aliases: ["product sku", "sku", "item code", "product code", "item"],
      },
      {
        key: "effective_date",
        label: "Effective Date",
        type: "date",
        required: true,
        description: "Agreed price effective date (YYYY-MM-DD)",
        aliases: ["effective date", "date", "agreed date", "rate date"],
      },
      {
        key: "price",
        label: "Selling Price / kg",
        type: "number",
        required: true,
        min: 0.01,
        description: "Agreed selling price per kg",
        aliases: ["price", "selling price", "rate", "agreed rate", "price per kg"],
      },
    ],
    dupKey: ["customer_code", "sku", "effective_date"],
    sample: {
      customer_code: "C101",
      sku: "SUG-50",
      effective_date: "2026-11-01",
      price: "44.00",
    },
  },
};

export type RowResult = {
  index: number;
  values: Record<string, string>;
  errors: string[];
  duplicate: boolean;
};

/** Normalize string for comparison by removing non-alphanumeric chars. */
export function normalizeKey(s: string): string {
  return (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Auto-map spreadsheet headers to fields with flexible aliases and fuzzy matching. */
export function autoMap(headers: string[], fields: FieldDef[]): Record<string, string> {
  const map: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  for (const f of fields) {
    const fieldTargets = [f.key, f.label, ...(f.aliases || [])].map(normalizeKey).filter(Boolean);

    // 1. Exact or alias match
    let match = headers.find((h) => {
      if (usedHeaders.has(h)) return false;
      const normH = normalizeKey(h);
      return normH !== "" && fieldTargets.includes(normH);
    });

    // 2. Substring match fallback (e.g. "Customer Phone Number" includes "phone")
    if (!match) {
      match = headers.find((h) => {
        if (usedHeaders.has(h)) return false;
        const normH = normalizeKey(h);
        return (
          normH !== "" &&
          fieldTargets.some((target) => normH.includes(target) || target.includes(normH))
        );
      });
    }

    if (match) {
      map[f.key] = match;
      usedHeaders.add(match);
    }
  }

  return map;
}

/** Flexible date parsing supporting YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY, and Excel serial numbers. */
export function parseDateString(raw: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();

  // Standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + "T00:00:00Z");
    if (!isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s) {
      return s;
    }
    return null;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    const year = dmy[3];
    const candidate = `${year}-${month}-${day}`;
    const d = new Date(candidate + "T00:00:00Z");
    if (!isNaN(d.getTime())) return candidate;
  }

  // Excel serial number (e.g. 45000)
  const num = Number(s);
  if (isFinite(num) && num > 25000 && num < 60000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }

  // Fallback to standard Date.parse
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/** Sanitize phone numbers without failing on optional punctuation. */
export function sanitizePhone(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/[^\d+]/g, "").trim();
  return cleaned || raw.trim();
}

/**
 * Validate rows. `existingKeys` are duplicate keys already in the database.
 * Never trusts raw spreadsheet values: every field is trimmed, type-checked, and sanitized.
 * Optional fields will NOT cause row failure.
 */
export function validateRows(
  raw: Record<string, unknown>[],
  fields: FieldDef[],
  mapping: Record<string, string>,
  dupKey: string[],
  existingKeys: Set<string> = new Set(),
  extra?: (v: Record<string, string>) => string[],
): RowResult[] {
  const seen = new Set<string>();

  return raw.map((r, index) => {
    const values: Record<string, string> = {};
    const errors: string[] = [];

    for (const f of fields) {
      const col = mapping[f.key];
      const rawVal = col !== undefined ? r[col] : undefined;
      const v = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : "";

      // Required field validation
      if (!v) {
        values[f.key] = "";
        if (f.required) {
          errors.push(`${f.label} is required`);
        }
        continue;
      }

      // Number validation
      if (f.type === "number") {
        const cleanNumber = v.replace(/[,₹$\s]/g, "");
        const n = Number(cleanNumber);
        if (!isFinite(n)) {
          if (f.required) {
            errors.push(`${f.label} must be a valid number`);
          }
        } else {
          values[f.key] = String(n);
          if (f.min !== undefined && n < f.min) {
            errors.push(`${f.label} must be at least ${f.min}`);
          }
        }
      }

      // Date validation
      else if (f.type === "date") {
        const formatted = parseDateString(v);
        if (!formatted) {
          if (f.required) {
            errors.push(`${f.label} must be a valid YYYY-MM-DD date`);
          }
        } else {
          values[f.key] = formatted;
        }
      }

      // Phone validation (optional and forgiving)
      else if (f.type === "phone") {
        const sanitized = sanitizePhone(v);
        values[f.key] = sanitized;
        // Only error if required or if user entered explicit non-phone characters without digits
        if (f.required && !/\d{6,}/.test(sanitized)) {
          errors.push(`${f.label} must contain at least 6 digits`);
        }
      }

      // Standard text
      else {
        values[f.key] = v;
      }
    }

    if (extra) {
      errors.push(...extra(values));
    }

    const key = dupKey.map((k) => (values[k] || "").toLowerCase().trim()).join("|");
    const isDup = key !== "" && (seen.has(key) || existingKeys.has(key));
    if (key !== "") seen.add(key);

    return {
      index,
      values,
      errors,
      duplicate: isDup,
    };
  });
}

export function toCsv(fields: FieldDef[], sample: Record<string, string>): string {
  return (
    fields.map((f) => f.key).join(",") +
    "\n" +
    fields.map((f) => sample[f.key] ?? "").join(",") +
    "\n"
  );
}
