import { describe, it, expect } from "vitest";
import { formatIDR, formatNumber } from "./format";

describe("formatIDR", () => {
  it("formats zero", () => {
    expect(formatIDR(0)).toBe("Rp 0");
  });

  it("formats positive integers", () => {
    expect(formatIDR(15000)).toBe("Rp 15.000");
    expect(formatIDR(100000)).toBe("Rp 100.000");
    expect(formatIDR(1000000)).toBe("Rp 1.000.000");
  });

  it("formats large numbers", () => {
    expect(formatIDR(100000000)).toBe("Rp 100.000.000");
  });

  it("rounds to zero decimal places", () => {
    expect(formatIDR(15000.5)).toBe("Rp 15.001");
  });
});

describe("formatNumber", () => {
  it("formats zero", () => {
    expect(formatNumber(0)).toBe("0");
  });

  it("formats positive integers", () => {
    expect(formatNumber(1000)).toBe("1.000");
    expect(formatNumber(1000000)).toBe("1.000.000");
  });

  it("formats small numbers without separators", () => {
    expect(formatNumber(1)).toBe("1");
    expect(formatNumber(999)).toBe("999");
  });
});
