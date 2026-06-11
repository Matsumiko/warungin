import { describe, it, expect } from "vitest";
import {
  on,
  toRate,
  calculateTransactionTotals,
  csvEscape,
  rowsToDelimited,
  parseCsv,
  csvRecords,
  toInt,
  periodClause,
  exportLabel,
  exportFilename,
} from "./backoffice-utils";

describe("on", () => {
  it('returns true for "1"', () => expect(on("1")).toBe(true));
  it('returns true for "true"', () => expect(on("true")).toBe(true));
  it('returns false for "0"', () => expect(on("0")).toBe(false));
  it('returns false for "false"', () => expect(on("false")).toBe(false));
  it("returns false for undefined", () => expect(on(undefined)).toBe(false));
  it("returns false for empty string", () => expect(on("")).toBe(false));
});

describe("toRate", () => {
  it("parses valid rate", () => expect(toRate("11")).toBe(11));
  it("clamps above 100", () => expect(toRate("150")).toBe(100));
  it("clamps below 0", () => expect(toRate("-10")).toBe(0));
  it("returns 0 for undefined", () => expect(toRate(undefined)).toBe(0));
  it("returns 0 for non-numeric", () => expect(toRate("abc")).toBe(0));
  it("returns 0 for Infinity", () => expect(toRate("Infinity")).toBe(0));
});

describe("calculateTransactionTotals", () => {
  const exclusiveSettings = {
    taxEnabled: "1",
    taxRate: "11",
    taxMode: "exclusive",
    serviceCharge: "0",
  };
  const inclusiveSettings = {
    taxEnabled: "1",
    taxRate: "11",
    taxMode: "inclusive",
    serviceCharge: "0",
  };
  const disabledTaxSettings = {
    taxEnabled: "0",
    taxRate: "11",
    taxMode: "exclusive",
    serviceCharge: "0",
  };
  const serviceSettings = {
    taxEnabled: "0",
    taxRate: "0",
    taxMode: "exclusive",
    serviceCharge: "5",
  };
  const bothSettings = {
    taxEnabled: "1",
    taxRate: "11",
    taxMode: "exclusive",
    serviceCharge: "5",
  };

  it("exclusive tax: subtotal 100, 11% → tax=11, total=111", () => {
    expect(calculateTransactionTotals(100, exclusiveSettings)).toEqual({
      tax: 11,
      serviceCharge: 0,
      total: 111,
    });
  });

  it("inclusive tax: subtotal 100, 11% → tax=10, total=100", () => {
    expect(calculateTransactionTotals(100, inclusiveSettings)).toEqual({
      tax: 10,
      serviceCharge: 0,
      total: 100,
    });
  });

  it("disabled tax: tax=0, total=subtotal", () => {
    expect(calculateTransactionTotals(100, disabledTaxSettings)).toEqual({
      tax: 0,
      serviceCharge: 0,
      total: 100,
    });
  });

  it("service charge only: 5% → serviceCharge=5, total=105", () => {
    expect(calculateTransactionTotals(100, serviceSettings)).toEqual({
      tax: 0,
      serviceCharge: 5,
      total: 105,
    });
  });

  it("both tax + service: exclusive 11% + 5% → tax=11, serviceCharge=5, total=116", () => {
    expect(calculateTransactionTotals(100, bothSettings)).toEqual({
      tax: 11,
      serviceCharge: 5,
      total: 116,
    });
  });

  it("zero tax rate → tax=0", () => {
    expect(
      calculateTransactionTotals(100, {
        taxEnabled: "1",
        taxRate: "0",
        taxMode: "exclusive",
        serviceCharge: "0",
      }),
    ).toEqual({ tax: 0, serviceCharge: 0, total: 100 });
  });

  it("subtotal 0 → all zeros", () => {
    expect(calculateTransactionTotals(0, exclusiveSettings)).toEqual({
      tax: 0,
      serviceCharge: 0,
      total: 0,
    });
  });
});

describe("csvEscape", () => {
  it("simple string returned as-is", () => expect(csvEscape("hello")).toBe("hello"));
  it("number converted to string", () => expect(csvEscape(42)).toBe("42"));
  it("null returns empty string", () => expect(csvEscape(null)).toBe(""));
  it("undefined returns empty string", () => expect(csvEscape(undefined)).toBe(""));
  it("comma is quoted", () => expect(csvEscape("a,b")).toBe('"a,b"'));
  it("double quote escaped", () => expect(csvEscape('say "hi"')).toBe('"say ""hi"""'));
  it("newline is quoted", () => expect(csvEscape("line1\nline2")).toBe('"line1\nline2"'));
  it("carriage return is quoted", () => expect(csvEscape("a\r\nb")).toBe('"a\r\nb"'));
});

describe("rowsToDelimited", () => {
  it("empty rows returns empty string", () => expect(rowsToDelimited([])).toBe(""));

  it("single row with headers", () => {
    const result = rowsToDelimited([{ name: "Alice", age: 30 }]);
    expect(result).toBe("name,age\nAlice,30");
  });

  it("multiple rows", () => {
    const result = rowsToDelimited([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]);
    expect(result).toBe("a,b\n1,2\n3,4");
  });

  it("custom delimiter (tab) separates fields, newline separates rows", () => {
    const result = rowsToDelimited([{ x: "a", y: "b" }], "\t");
    expect(result).toBe("x\ty\na\tb");
  });

  it("values with commas are escaped", () => {
    const result = rowsToDelimited([{ note: "hello, world" }]);
    expect(result).toBe('note\n"hello, world"');
  });
});

describe("parseCsv", () => {
  it("simple CSV", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("quoted field with comma inside", () => {
    expect(parseCsv('a,b\n"hello, world",2')).toEqual([
      ["a", "b"],
      ["hello, world", "2"],
    ]);
  });

  it("escaped double quotes", () => {
    expect(parseCsv('a,b\n"say ""hi""",ok')).toEqual([
      ["a", "b"],
      ['say "hi"', "ok"],
    ]);
  });

  it("empty lines are skipped", () => {
    expect(parseCsv("a,b\n\n1,2\n\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("trailing newline no empty row", () => {
    expect(parseCsv("a,b\n1,2\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("single row no newline", () => {
    expect(parseCsv("a,b")).toEqual([["a", "b"]]);
  });
});

describe("csvRecords", () => {
  it("normal CSV to objects", () => {
    const result = csvRecords("Name,Age\nAlice,30\nBob,25");
    expect(result).toEqual([
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ]);
  });

  it("empty content returns empty array", () => {
    expect(csvRecords("")).toEqual([]);
  });

  it("headers normalized to snake_case lowercase", () => {
    const result = csvRecords("First Name,Stock Qty\nA,1");
    expect(result[0]).toHaveProperty("first_name");
    expect(result[0]).toHaveProperty("stock_qty");
  });
});

describe("toInt", () => {
  it("normal digits", () => expect(toInt("42")).toBe(42));
  it("non-numeric stripped", () => expect(toInt("$100")).toBe(100));
  it("fallback on empty", () => expect(toInt("")).toBe(0));
  it("custom fallback", () => expect(toInt("", 5)).toBe(5));
  it("Infinity returns fallback", () => expect(toInt("Infinity")).toBe(0));
  it("negative clamped to 0", () => expect(toInt("-5")).toBe(0));
  it("strips non-digit chars from float", () => expect(toInt("3.7")).toBe(37));
});

describe("periodClause", () => {
  it("hari-ini", () => {
    const result = periodClause("hari-ini", "created_at");
    expect(result.sql).toContain("date('now', 'localtime')");
  });

  it("minggu-ini", () => {
    const result = periodClause("minggu-ini", "created_at");
    expect(result.sql).toContain("-7 days");
  });

  it("3-bulan", () => {
    const result = periodClause("3-bulan", "created_at");
    expect(result.sql).toContain("-3 months");
  });

  it("default (bulan-ini)", () => {
    const result = periodClause("bulan-ini", "created_at");
    expect(result.sql).toContain("start of month");
  });
});

describe("exportLabel", () => {
  it("products", () => expect(exportLabel("products")).toBe("Produk"));
  it("transactions", () => expect(exportLabel("transactions")).toBe("Transaksi"));
  it("shifts", () => expect(exportLabel("shifts")).toBe("Laporan Shift"));
  it("stock", () => expect(exportLabel("stock")).toBe("Stok & Mutasi"));
});

describe("exportFilename", () => {
  it("CSV format", () => {
    const name = exportFilename("products", "CSV");
    expect(name).toMatch(/^warungin-products-\d{4}-\d{2}-\d{2}\.csv$/);
  });

  it("Excel format uses .xls", () => {
    const name = exportFilename("transactions", "Excel");
    expect(name).toMatch(/\.xls$/);
    expect(name).not.toMatch(/\.xlsx$/);
  });

  it("PDF format", () => {
    const name = exportFilename("shifts", "PDF");
    expect(name).toMatch(/\.pdf$/);
  });
});
