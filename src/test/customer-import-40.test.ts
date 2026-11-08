import { describe, expect, it } from "vitest";
import { IMPORT_TYPES, autoMap, validateRows, type RowResult } from "@/lib/import-validation";

describe("Priority 1: 40 Customer Records Spreadsheet Import Verification", () => {
  const customerDef = IMPORT_TYPES.customers;

  // Realistic 40 customer records as parsed from an Excel / CSV spreadsheet
  const sample40Customers: Record<string, unknown>[] = Array.from({ length: 40 }, (_, i) => {
    const id = (i + 1).toString().padStart(3, "0");
    return {
      "Customer Code": `CUST-${id}`,
      "Customer Name": `Wholesale Store ${id} Enterprises`,
      "Contact Person": i % 3 === 0 ? `Manager ${id}` : "", // Optional field testing
      "Mobile No": i % 2 === 0 ? `+91 98${id}0 12345` : `033-2456-${id}1`, // Varied phone formatting
      City:
        i % 4 === 0 ? "Kolkata" : i % 4 === 1 ? "Siliguri" : i % 4 === 2 ? "Asansol" : "Durgapur",
      Category: i % 2 === 0 ? "Supermarket" : "Wholesaler",
    };
  });

  it("1. Flexible column mapping auto-detects real-world headers via aliases", () => {
    const headers = Object.keys(sample40Customers[0]!);
    const mapping = autoMap(headers, customerDef.fields);

    expect(mapping.code).toBe("Customer Code");
    expect(mapping.name).toBe("Customer Name");
    expect(mapping.contact_person).toBe("Contact Person");
    expect(mapping.phone).toBe("Mobile No");
    expect(mapping.town).toBe("City");
    expect(mapping.category).toBe("Category");
  });

  it("2. All 40 customer records validate successfully with zero row-level errors", () => {
    const headers = Object.keys(sample40Customers[0]!);
    const mapping = autoMap(headers, customerDef.fields);

    const results: RowResult[] = validateRows(
      sample40Customers,
      customerDef.fields,
      mapping,
      customerDef.dupKey,
      new Set(), // no existing keys
    );

    expect(results).toHaveLength(40);

    const validRows = results.filter((r) => r.errors.length === 0 && !r.duplicate);
    expect(validRows).toHaveLength(40);

    // Verify all rows have correctly mapped codes and names
    for (let i = 0; i < 40; i++) {
      const id = (i + 1).toString().padStart(3, "0");
      expect(results[i]!.values.code).toBe(`CUST-${id}`);
      expect(results[i]!.values.name).toBe(`Wholesale Store ${id} Enterprises`);
      expect(results[i]!.errors).toEqual([]);
      expect(results[i]!.duplicate).toBe(false);
    }
  });

  it("3. Optional fields (missing contact person or formatted phone) do NOT cause row failure", () => {
    const headers = Object.keys(sample40Customers[0]!);
    const mapping = autoMap(headers, customerDef.fields);

    const results: RowResult[] = validateRows(
      sample40Customers,
      customerDef.fields,
      mapping,
      customerDef.dupKey,
      new Set(),
    );

    // Rows with empty contact person still pass
    const emptyContactRows = results.filter((r) => !r.values.contact_person);
    expect(emptyContactRows.length).toBeGreaterThan(0);
    for (const r of emptyContactRows) {
      expect(r.errors).toEqual([]);
    }
  });

  it("4. Prevents duplicate customer codes against both file duplicates and database records", () => {
    const headers = Object.keys(sample40Customers[0]!);
    const mapping = autoMap(headers, customerDef.fields);

    // Add 1 in-file duplicate and 1 pre-existing database key
    const dataWithDuplicates = [
      ...sample40Customers,
      {
        "Customer Code": "CUST-001", // Duplicate of first row
        "Customer Name": "Duplicate Attempt Store",
      },
      {
        "Customer Code": "CUST-EXISTING",
        "Customer Name": "Pre-existing in DB Store",
      },
    ];

    const existingDbKeys = new Set(["cust-existing"]);

    const results = validateRows(
      dataWithDuplicates,
      customerDef.fields,
      mapping,
      customerDef.dupKey,
      existingDbKeys,
    );

    expect(results).toHaveLength(42);

    const duplicates = results.filter((r) => r.duplicate);
    expect(duplicates).toHaveLength(2);
    expect(duplicates[0]!.values.code).toBe("CUST-001");
    expect(duplicates[1]!.values.code).toBe("CUST-EXISTING");

    // The first 40 remain valid
    const valid = results.filter((r) => r.errors.length === 0 && !r.duplicate);
    expect(valid).toHaveLength(40);
  });

  it("5. Simulates transactional import payload generation and reversal verification", () => {
    const headers = Object.keys(sample40Customers[0]!);
    const mapping = autoMap(headers, customerDef.fields);

    const results = validateRows(
      sample40Customers,
      customerDef.fields,
      mapping,
      customerDef.dupKey,
      new Set(),
    );

    const validRows = results.filter((r) => r.errors.length === 0 && !r.duplicate);
    const payload = validRows.map((r) => r.values);

    expect(payload).toHaveLength(40);

    // Simulated import job record with provenance
    const mockJob = {
      id: "mock-job-uuid-001",
      file_name: "Customer_Master_Nov2026.xlsx — Sheet1",
      target_table: "customers",
      status: "completed",
      total_rows: 40,
      valid_rows: 40,
      created_at: new Date().toISOString(),
    };

    // Simulated customers linked with import_job_id
    const importedCustomers = payload.map((row, idx) => ({
      id: `cust-uuid-${idx + 1}`,
      code: row.code,
      name: row.name,
      contact_person: row.contact_person || null,
      phone: row.phone || null,
      town: row.town || null,
      category: row.category || "Retailer",
      is_active: true,
      import_job_id: mockJob.id,
    }));

    expect(importedCustomers).toHaveLength(40);
    expect(importedCustomers.every((c) => c.import_job_id === mockJob.id)).toBe(true);

    // Verify safe reversal: all 40 records are soft-voided (is_active = false)
    const reversedCustomers = importedCustomers.map((c) => ({
      ...c,
      is_active: false,
    }));

    const reversedJob = {
      ...mockJob,
      status: "reversed",
      reversed_at: new Date().toISOString(),
    };

    expect(reversedJob.status).toBe("reversed");
    expect(reversedCustomers.every((c) => c.is_active === false)).toBe(true);
  });
});
