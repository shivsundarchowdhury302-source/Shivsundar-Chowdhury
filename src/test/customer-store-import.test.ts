import { describe, expect, it, beforeEach } from "vitest";
import {
  bulkImportCustomers,
  getLocalStoredCustomers,
  saveLocalStoredCustomers,
  seed40CustomersToStore,
} from "@/lib/customer-store";
import { getDataSource, setDataSource } from "@/lib/data-source";

describe("Customer Store & Spreadsheet Import Integration", () => {
  beforeEach(() => {
    saveLocalStoredCustomers([]);
    setDataSource("demo");
  });

  it("1. bulkImportCustomers accepts new customer names and details, assigns codes, and persists them", async () => {
    const rawRows = [
      {
        "Customer Name": "New Horizon Supermarket",
        "Contact Person": "Alok Roy",
        "Mobile No": "+91 98300 99887",
        City: "Kolkata",
        Category: "Supermarket",
        "Credit Limit": "250000",
      },
      {
        "Customer Name": "Maa Durga Bakery & Sweets",
        "Contact Person": "Bikash Paul",
        "Mobile No": "+91 98300 55443",
        City: "Siliguri",
        Category: "Bakery",
        "Credit Limit": "150000",
      },
    ];

    const result = await bulkImportCustomers(rawRows);
    expect(result.added).toBe(2);
    expect(result.customers).toHaveLength(2);

    const stored = getLocalStoredCustomers();
    expect(stored).toHaveLength(2);
    expect(stored[0]!.name).toBe("New Horizon Supermarket");
    expect(stored[0]!.code).toMatch(/^CUST-\d{4}$/);
    expect(stored[0]!.town).toBe("Kolkata");
    expect(stored[0]!.category).toBe("Supermarket");
    expect(stored[0]!.credit_limit).toBe(250000);

    // Verify it automatically switched active data mode to 'real'
    expect(getDataSource()).toBe("real");
  });

  it("2. seed40CustomersToStore populates 40 complete wholesale customer accounts", () => {
    const seeded = seed40CustomersToStore();
    expect(seeded).toHaveLength(40);

    // Verify properties of the seeded 40 customer accounts
    for (let i = 0; i < 40; i++) {
      const c = seeded[i]!;
      expect(c.name).toContain("Wholesale Enterprise");
      expect(c.code).toMatch(/^CUST-\d{3}$/);
      expect(c.credit_limit).toBeGreaterThanOrEqual(75000);
      expect(c.credit_days).toBeGreaterThanOrEqual(15);
      expect(c.town).toBeTruthy();
      expect(c.category).toBeTruthy();
    }

    expect(getDataSource()).toBe("real");
  });
});
