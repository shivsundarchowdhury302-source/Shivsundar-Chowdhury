import type { BusinessData } from "./assistant-engine";

export type DemoCustomerSummary = {
  id: string;
  code: string;
  name: string;
  category: string;
  town: string;
  phone: string;
  contact_person: string;
  is_sample: boolean;
  total_sales: number;
  total_cost: number;
  gross_profit: number;
  invoice_count: number;
  last_purchase_date: string;
  outstanding: number;
  overdue: number;
  credit_limit: number;
  credit_days: number;
};

export const DEMO_CUSTOMERS_RAW = [
  {
    id: "10000000-0000-0000-0000-000000000001",
    code: "C001",
    name: "Maa Tara Bhandar",
    contact_person: "Subrata Ghosh",
    phone: "98000 00001",
    town: "Berhampore",
    category: "Retailer",
  },
  {
    id: "10000000-0000-0000-0000-000000000002",
    code: "C002",
    name: "Annapurna Sweets",
    contact_person: "Kakoli Das",
    phone: "98000 00002",
    town: "Berhampore",
    category: "Sweet Shop",
  },
  {
    id: "10000000-0000-0000-0000-000000000003",
    code: "C003",
    name: "Lalbagh Grocery Mart",
    contact_person: "Rafiq Sheikh",
    phone: "98000 00003",
    town: "Lalbagh",
    category: "Wholesaler",
  },
  {
    id: "10000000-0000-0000-0000-000000000004",
    code: "C004",
    name: "Jiaganj Traders",
    contact_person: "Pradip Saha",
    phone: "98000 00004",
    town: "Jiaganj",
    category: "Wholesaler",
  },
  {
    id: "10000000-0000-0000-0000-000000000005",
    code: "C005",
    name: "Sri Krishna Hotel",
    contact_person: "Biswajit Mondal",
    phone: "98000 00005",
    town: "Berhampore",
    category: "Hotel / Restaurant",
  },
  {
    id: "10000000-0000-0000-0000-000000000006",
    code: "C006",
    name: "Kandi Bazar Stores",
    contact_person: "Anwar Hossain",
    phone: "98000 00006",
    town: "Kandi",
    category: "Retailer",
  },
  {
    id: "10000000-0000-0000-0000-000000000007",
    code: "C007",
    name: "New Bakery Udyog",
    contact_person: "Tapan Pal",
    phone: "98000 00007",
    town: "Beldanga",
    category: "Bakery",
  },
  {
    id: "10000000-0000-0000-0000-000000000008",
    code: "C008",
    name: "Domkal Food Supply",
    contact_person: "Mizanur Rahman",
    phone: "98000 00008",
    town: "Domkal",
    category: "Wholesaler",
  },
  {
    id: "10000000-0000-0000-0000-000000000009",
    code: "C009",
    name: "Ganga Kirana",
    contact_person: "Rita Sarkar",
    phone: "98000 00009",
    town: "Berhampore",
    category: "Retailer",
  },
  {
    id: "10000000-0000-0000-0000-000000000010",
    code: "C010",
    name: "Hari Om Caterers",
    contact_person: "Gopal Dey",
    phone: "98000 00010",
    town: "Berhampore",
    category: "Caterer",
  },
  {
    id: "10000000-0000-0000-0000-000000000011",
    code: "C011",
    name: "Farakka Provision",
    contact_person: "Sanjib Roy",
    phone: "98000 00011",
    town: "Farakka",
    category: "Retailer",
  },
  {
    id: "10000000-0000-0000-0000-000000000012",
    code: "C012",
    name: "Murshidabad Mishti Ghar",
    contact_person: "Ananya Bose",
    phone: "98000 00012",
    town: "Murshidabad",
    category: "Sweet Shop",
  },
];

export const DEMO_PRODUCTS_RAW = [
  {
    id: "20000000-0000-0000-0000-000000000001",
    sku: "SUG-50",
    name: "Sugar (S-30)",
    category: "Sugar",
    unit: "kg",
    pack_size_kg: 50,
    cost: 39.5,
  },
  {
    id: "20000000-0000-0000-0000-000000000002",
    sku: "MAI-50",
    name: "Maida",
    category: "Flour",
    unit: "kg",
    pack_size_kg: 50,
    cost: 31,
  },
  {
    id: "20000000-0000-0000-0000-000000000003",
    sku: "ATT-30",
    name: "Chakki Atta",
    category: "Flour",
    unit: "kg",
    pack_size_kg: 30,
    cost: 29,
  },
  {
    id: "20000000-0000-0000-0000-000000000004",
    sku: "SUJ-30",
    name: "Suji",
    category: "Flour",
    unit: "kg",
    pack_size_kg: 30,
    cost: 34,
  },
  {
    id: "20000000-0000-0000-0000-000000000005",
    sku: "OIL-15",
    name: "Mustard Oil (15 L tin)",
    category: "Edible Oil",
    unit: "kg",
    pack_size_kg: 15,
    cost: 148,
  },
  {
    id: "20000000-0000-0000-0000-000000000006",
    sku: "OIL-SB",
    name: "Soyabean Oil (15 L tin)",
    category: "Edible Oil",
    unit: "kg",
    pack_size_kg: 15,
    cost: 122,
  },
  {
    id: "20000000-0000-0000-0000-000000000007",
    sku: "DAL-MSR",
    name: "Masoor Dal",
    category: "Dals",
    unit: "kg",
    pack_size_kg: 50,
    cost: 72,
  },
  {
    id: "20000000-0000-0000-0000-000000000008",
    sku: "DAL-MNG",
    name: "Moong Dal",
    category: "Dals",
    unit: "kg",
    pack_size_kg: 30,
    cost: 96,
  },
  {
    id: "20000000-0000-0000-0000-000000000009",
    sku: "DAL-CHN",
    name: "Chana Dal",
    category: "Dals",
    unit: "kg",
    pack_size_kg: 30,
    cost: 68,
  },
  {
    id: "20000000-0000-0000-0000-000000000010",
    sku: "MAS-HLD",
    name: "Turmeric Powder",
    category: "Masalas",
    unit: "kg",
    pack_size_kg: 25,
    cost: 165,
  },
];

export const DEMO_GODOWNS = [
  "Main Shop",
  "Godown 1 – Khagra",
  "Godown 2 – Gorabazar",
  "Godown 3 – Panchanantala",
  "Godown 4 – Indraprastha",
  "Godown 5 – Chuanpur",
  "Godown 6 – Banjetia",
];

// Simple deterministic hash
function hashStr(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

let cachedDemoData: { asOf: string; data: BusinessData } | null = null;

export function getDemonstrationData(asOfDate?: string): BusinessData {
  const today = asOfDate ?? new Date().toISOString().slice(0, 10);
  if (cachedDemoData && cachedDemoData.asOf === today) {
    return cachedDemoData.data;
  }

  const todayDate = new Date(`${today}T00:00:00Z`);
  const dateOffset = (days: number) => {
    const d = new Date(todayDate.getTime() - days * 86400000);
    return d.toISOString().slice(0, 10);
  };

  const customers = DEMO_CUSTOMERS_RAW.map((c) => ({
    id: c.id,
    name: c.name,
    code: c.code,
  }));

  const products = DEMO_PRODUCTS_RAW.map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
  }));

  // Limits
  const limits: BusinessData["limits"] = DEMO_CUSTOMERS_RAW.map((c) => {
    const isBig = ["C003", "C004", "C008"].includes(c.code);
    const isMed = ["C002", "C005", "C010", "C012"].includes(c.code);
    return {
      customer_id: c.id,
      credit_limit: isBig ? 800000 : isMed ? 300000 : 150000,
      effective_from: dateOffset(90),
    };
  });

  // Product landed cost history (weekly for 13 weeks)
  const costs: BusinessData["costs"] = [];
  for (const p of DEMO_PRODUCTS_RAW) {
    for (let w = 0; w <= 12; w++) {
      const landed = Number(
        (p.cost * (1 + 0.04 * Math.sin(w / 2.0 + p.sku.length) + 0.002 * w)).toFixed(2),
      );
      costs.push({
        product_id: p.id,
        effective_date: dateOffset(w * 7),
        landed_cost: landed,
        is_void: false,
      });
    }
  }

  // Customer price history (customer price agreements)
  const prices: BusinessData["prices"] = [];
  for (const c of DEMO_CUSTOMERS_RAW) {
    const codeNum = parseInt(c.code.slice(1), 10);
    const factor = 1.04 + (codeNum % 5) * 0.025;
    for (const p of DEMO_PRODUCTS_RAW) {
      for (let m = 0; m <= 2; m++) {
        // C004 (Jiaganj Traders) with SUG-50 (Sugar) agreed price is ₹36.50, which is ₹3.00 below landed cost
        const isBelowCost = c.code === "C004" && p.sku === "SUG-50";
        const price = isBelowCost ? 36.5 : Number((p.cost * (factor - 0.01 * m)).toFixed(2));
        prices.push({
          customer_id: c.id,
          product_id: p.id,
          effective_date: dateOffset(m * 30),
          price,
          is_void: false,
        });
      }
    }
  }

  // Inventory across the 7 godowns
  const inventory: BusinessData["inventory"] = [];
  for (const p of DEMO_PRODUCTS_RAW) {
    for (const g of DEMO_GODOWNS) {
      const h = hashStr(`${p.sku}|${g}`);
      const qty = p.pack_size_kg * (20 + (h % 120));
      inventory.push({
        product_id: p.id,
        godown: g,
        snapshot_date: today,
        quantity_kg: qty,
        avg_cost: p.cost,
      });
    }
  }

  // Sales and Sale items over 180 days (to allow period-over-period purchase decline analytics)
  const sales: BusinessData["sales"] = [];
  const items: BusinessData["items"] = [];

  let saleCounter = 1;
  let itemCounter = 1;

  for (const c of DEMO_CUSTOMERS_RAW) {
    const codeNum = parseInt(c.code.slice(1), 10);
    const factor = 1.04 + (codeNum % 5) * 0.025;
    const isWholesaler = ["C003", "C004", "C008"].includes(c.code);
    const hasDeclined = ["C006", "C007"].includes(c.code);

    for (let d = 0; d < 180; d++) {
      const h = hashStr(`${c.code}-${d}`);
      // Customers with purchase decline bought heavily in days 90-180 and reduced in days 0-89
      let threshold = isWholesaler ? 4 : 2;
      if (hasDeclined) {
        threshold = d >= 90 ? 4 : 1;
      }
      if (h % 7 >= threshold) continue;

      const saleDate = dateOffset(d);
      const dueDate = dateOffset(d - 30); // 30 day credit
      const saleId = `30000000-0000-0000-0000-${String(saleCounter++).padStart(12, "0")}`;

      let totalAmount = 0;
      let totalCost = 0;

      // 1 to 3 items per invoice
      const selectedProducts = DEMO_PRODUCTS_RAW.filter(
        (p2) => hashStr(`${saleId}-${p2.sku}`) % 4 === 0,
      ).slice(0, 3);
      const chosen =
        selectedProducts.length > 0
          ? selectedProducts
          : [DEMO_PRODUCTS_RAW[h % DEMO_PRODUCTS_RAW.length]!];

      for (const p of chosen) {
        const qtyMultiplier = 1 + (hashStr(`${saleId}-${p.sku}-q`) % (isWholesaler ? 8 : 3));
        const qty = p.pack_size_kg * qtyMultiplier;
        const discount = c.code === "C004" && p.sku === "SUG-50" ? -2.5 : 0;
        const unitPrice = Number((p.cost * factor + discount).toFixed(2));
        const unitCost = Number(p.cost.toFixed(2));
        const lineTotal = Number((qty * unitPrice).toFixed(2));

        totalAmount += lineTotal;
        totalCost += Number((qty * unitCost).toFixed(2));

        items.push({
          id: `40000000-0000-0000-0000-${String(itemCounter++).padStart(12, "0")}`,
          sale_id: saleId,
          product_id: p.id,
          quantity_kg: qty,
          unit_price: unitPrice,
          unit_cost: unitCost,
          line_total: lineTotal,
        });
      }

      sales.push({
        id: saleId,
        customer_id: c.id,
        sale_date: saleDate,
        total_amount: Number(totalAmount.toFixed(2)),
        total_cost: Number(totalCost.toFixed(2)),
        due_date: dueDate,
        payment_type: "credit",
        is_void: false,
      });
    }
  }

  // Payments and Allocations
  const payments: BusinessData["payments"] = [];
  const allocations: BusinessData["allocations"] = [];
  let paymentCounter = 1;

  for (const c of DEMO_CUSTOMERS_RAW) {
    const ownSales = sales.filter((s) => s.customer_id === c.id);
    const isLagging = ["C006", "C010", "C011"].includes(c.code);
    const isJiaganj = c.code === "C004";
    const payRatio = isLagging ? 0.55 : isJiaganj ? 0.75 : 0.92;

    for (let w = 1; w <= 12; w++) {
      const weekStart = dateOffset(w * 7 + 13);
      const weekEnd = dateOffset(w * 7 + 7);
      const weekSales = ownSales.filter((s) => s.sale_date >= weekStart && s.sale_date <= weekEnd);
      const weekTotal = weekSales.reduce((acc, s) => acc + s.total_amount, 0);

      if (weekTotal <= 0) continue;

      const pmtAmount = Number((weekTotal * payRatio).toFixed(2));
      const paymentDate = dateOffset(w * 7);
      const paymentId = `50000000-0000-0000-0000-${String(paymentCounter++).padStart(12, "0")}`;

      payments.push({
        id: paymentId,
        customer_id: c.id,
        payment_date: paymentDate,
        amount: pmtAmount,
        is_void: false,
      });

      // Allocate payment to matching sales
      let remaining = pmtAmount;
      for (const s of weekSales) {
        if (remaining <= 0) break;
        const alloc = Math.min(remaining, s.total_amount);
        allocations.push({
          payment_id: paymentId,
          sale_id: s.id,
          amount: Number(alloc.toFixed(2)),
        });
        remaining -= alloc;
      }
    }
  }

  // Demonstration market prices
  const market_prices: BusinessData["market_prices"] = [
    {
      id: "mkt-1",
      product_id: DEMO_PRODUCTS_RAW[0]!.id, // Sugar
      source_name: "Burrabazar Wholesale Mandi",
      price_date: today,
      price: 43.5,
      is_void: false,
    },
    {
      id: "mkt-2",
      product_id: DEMO_PRODUCTS_RAW[1]!.id, // Maida
      source_name: "Siliguri Grain Exchange",
      price_date: today,
      price: 34.0,
      is_void: false,
    },
    {
      id: "mkt-3",
      product_id: DEMO_PRODUCTS_RAW[4]!.id, // Mustard Oil
      source_name: "Kolkata APMC",
      price_date: today,
      price: 154.0,
      is_void: false,
    },
    {
      id: "mkt-4",
      product_id: DEMO_PRODUCTS_RAW[6]!.id, // Masoor Dal
      source_name: "Posta Bazar Dal Mandi",
      price_date: today,
      price: 78.0,
      is_void: false,
    },
  ];

  // Demonstration suppliers
  const suppliers: BusinessData["suppliers"] = [
    {
      id: "sup-1",
      name: "Bengal Sugar Agencies",
      phone: "+91 98300 11001",
      town: "Kolkata",
    },
    {
      id: "sup-2",
      name: "Eastern Flour Mills",
      phone: "+91 98300 22002",
      town: "Durgapur",
    },
    {
      id: "sup-3",
      name: "Shree Oils Pvt (Refineries)",
      phone: "+91 98300 33003",
      town: "Kolkata",
    },
  ];

  // Demonstration inward purchases
  const purchases: BusinessData["purchases"] = [
    {
      id: "pur-1",
      supplier_id: "sup-1",
      product_id: DEMO_PRODUCTS_RAW[0]!.id,
      purchase_date: new Date(Date.parse(today) - 3 * 86400000).toISOString().slice(0, 10),
      quantity_kg: 5000,
      unit_cost: 39.0,
      freight_per_kg: 0.5,
      godown: "Main Shop",
    },
    {
      id: "pur-2",
      supplier_id: "sup-2",
      product_id: DEMO_PRODUCTS_RAW[1]!.id,
      purchase_date: new Date(Date.parse(today) - 35 * 86400000).toISOString().slice(0, 10),
      quantity_kg: 4000,
      unit_cost: 30.5,
      freight_per_kg: 0.5,
      godown: "Godown 1",
    },
    {
      id: "pur-3",
      supplier_id: "sup-3",
      product_id: DEMO_PRODUCTS_RAW[4]!.id,
      purchase_date: new Date(Date.parse(today) - 6 * 86400000).toISOString().slice(0, 10),
      quantity_kg: 1500,
      unit_cost: 145.0,
      freight_per_kg: 3.0,
      godown: "Godown 2",
    },
  ];

  // Demonstration operating expenses
  const expenses: BusinessData["expenses"] = [
    {
      id: "exp-1",
      expense_date: new Date(Date.parse(today) - 10 * 86400000).toISOString().slice(0, 10),
      category: "Godown Rent & Storage",
      amount: 45000,
      note: "Monthly warehouse lease",
    },
    {
      id: "exp-2",
      expense_date: new Date(Date.parse(today) - 12 * 86400000).toISOString().slice(0, 10),
      category: "Staff Salaries & Labor",
      amount: 95000,
      note: "Warehouse and driving crew payroll",
    },
    {
      id: "exp-3",
      expense_date: new Date(Date.parse(today) - 18 * 86400000).toISOString().slice(0, 10),
      category: "Local Transport & Fuel",
      amount: 28000,
      note: "Distribution lorry diesel",
    },
    {
      id: "exp-4",
      expense_date: new Date(Date.parse(today) - 25 * 86400000).toISOString().slice(0, 10),
      category: "Packaging & Jute Sacks",
      amount: 14500,
      note: "Commodity re-packing sacks",
    },
    {
      id: "exp-5",
      expense_date: new Date(Date.parse(today) - 28 * 86400000).toISOString().slice(0, 10),
      category: "Electricity & Utilities",
      amount: 12000,
      note: "Godown lighting and power",
    },
  ];

  const result: BusinessData = {
    customers,
    products,
    sales,
    items,
    payments,
    allocations,
    limits,
    costs,
    prices,
    inventory,
    market_prices,
    suppliers,
    purchases,
    expenses,
  };

  cachedDemoData = { asOf: today, data: result };
  return result;
}

export function getDemoCustomerSummary(today?: string): DemoCustomerSummary[] {
  const db = getDemonstrationData(today);
  const asOf = today ?? new Date().toISOString().slice(0, 10);

  return DEMO_CUSTOMERS_RAW.map((c) => {
    const ownSales = db.sales.filter((s) => s.customer_id === c.id && !s.is_void);
    const totalSales = ownSales.reduce((sum, s) => sum + s.total_amount, 0);
    const totalCost = ownSales.reduce((sum, s) => sum + s.total_cost, 0);
    const grossProfit = totalSales - totalCost;

    // Last purchase date
    const sortedSales = [...ownSales].sort((a, b) => b.sale_date.localeCompare(a.sale_date));
    const lastPurchaseDate = sortedSales[0]?.sale_date ?? asOf;

    // Outstanding balance strictly via payment allocations
    const validPayments = new Set(
      db.payments.filter((p) => !p.is_void && p.customer_id === c.id).map((p) => p.id),
    );
    let totalOutstanding = 0;
    let totalOverdue = 0;

    for (const s of ownSales) {
      const allocated = db.allocations
        .filter((a) => a.sale_id === s.id && validPayments.has(a.payment_id))
        .reduce((sum, a) => sum + a.amount, 0);
      const balance = Math.max(0, s.total_amount - allocated);
      totalOutstanding += balance;
      if (s.due_date && s.due_date < asOf) {
        totalOverdue += balance;
      }
    }

    const limit = db.limits.find((l) => l.customer_id === c.id)?.credit_limit ?? 150000;
    const creditDays = ["C003", "C004", "C008"].includes(c.code) ? 30 : 15;

    return {
      id: c.id,
      code: c.code,
      name: c.name,
      category: c.category,
      town: c.town,
      phone: c.phone,
      contact_person: c.contact_person,
      is_sample: true,
      total_sales: Number(totalSales.toFixed(2)),
      total_cost: Number(totalCost.toFixed(2)),
      gross_profit: Number(grossProfit.toFixed(2)),
      invoice_count: ownSales.length,
      last_purchase_date: lastPurchaseDate,
      outstanding: Number(totalOutstanding.toFixed(2)),
      overdue: Number(totalOverdue.toFixed(2)),
      credit_limit: limit,
      credit_days: creditDays,
    };
  });
}
