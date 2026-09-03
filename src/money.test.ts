import { describe, expect, it } from "vitest";
import * as M from "./money";
import type { Result } from "./result";
import { decodeDecimalWire, decodeMinorWire, toDecimalWire } from "./wire";

const val = <A, E>(r: Result<A, E>): A => {
  if (!r.ok) throw new Error(`expected ok, got ${JSON.stringify(r.error)}`);
  return r.value;
};
const error = <A, E>(r: Result<A, E>): E => {
  if (r.ok) throw new Error("expected error");
  return r.error;
};

const chf = (minor: number) => val(M.fromMinor(minor, "CHF"));

describe("construction", () => {
  it("fromDecimal parses strings and numbers exactly", () => {
    expect(val(M.fromDecimal("12.50", "CHF")).minor).toBe(1250);
    expect(val(M.fromDecimal("12.5", "CHF")).minor).toBe(1250);
    expect(val(M.fromDecimal("12", "CHF")).minor).toBe(1200);
    expect(val(M.fromDecimal(12.5, "CHF")).minor).toBe(1250);
    expect(val(M.fromDecimal("-0.05", "EUR")).minor).toBe(-5);
    expect(Object.is(val(M.fromDecimal("-0", "EUR")).minor, 0)).toBe(true);
  });

  it("fromDecimal rejects what it cannot represent", () => {
    expect(error(M.fromDecimal("12.505", "CHF"))._tag).toBe("InvalidAmount");
    expect(error(M.fromDecimal(0.1 + 0.2, "CHF"))._tag).toBe("InvalidAmount");
    expect(error(M.fromDecimal("1e3", "CHF"))._tag).toBe("InvalidAmount");
    expect(error(M.fromDecimal("CHF 12", "CHF"))._tag).toBe("InvalidAmount");
    expect(error(M.fromDecimal("1'000", "CHF"))._tag).toBe("InvalidAmount");
  });

  it("fromMinor rejects non-integers and unsafe integers", () => {
    expect(error(M.fromMinor(1.5, "CHF"))._tag).toBe("InvalidAmount");
    expect(error(M.fromMinor(NaN, "CHF"))._tag).toBe("InvalidAmount");
    expect(error(M.fromMinor(2 ** 53, "CHF"))._tag).toBe("InvalidAmount");
  });

  it("is frozen and comparable", () => {
    expect(Object.isFrozen(chf(1))).toBe(true);
    expect(M.equals(chf(100), chf(100))).toBe(true);
    expect(M.equals(chf(100), val(M.fromMinor(100, "EUR")))).toBe(false);
    expect(M.isMoney(chf(1))).toBe(true);
    expect(M.isMoney({ minor: 1.5, currency: "CHF" })).toBe(false);
    expect(M.isMoney(null)).toBe(false);
    expect(M.isMoney({ minor: 1, currency: "XYZ" })).toBe(false);
    expect(M.isCurrencyCode(42)).toBe(false);
    expect(M.minorDigits("CHF")).toBe(2);
  });
});

describe("representation", () => {
  it("toDecimalString is exact", () => {
    expect(M.toDecimalString(chf(1250))).toBe("12.50");
    expect(M.toDecimalString(chf(5))).toBe("0.05");
    expect(M.toDecimalString(chf(-5))).toBe("-0.05");
    expect(M.toDecimalString(chf(0))).toBe("0.00");
  });

  it("format is locale aware", () => {
    const m = chf(123450);
    expect(M.format(m, "de-CH")).toMatch(/^CHF\s1.234\.50$/);
    expect(M.format(m, "de-CH")).toMatch(/^CHF\s1.234\.50$/);
    expect(M.format(m, "en-US")).toMatch(/^CHF\s1,234\.50$/);
    expect(M.format(val(M.fromMinor(123450, "USD")), "en-US")).toBe("$1,234.50");
    expect(M.format(val(M.fromMinor(123450, "BAM")), "bs-BA")).toMatch(/KM/);
    expect(M.format(m, "en-US", "name")).toBe("1,234.50 Swiss francs");
  });
});

describe("arithmetic", () => {
  it("add / subtract respect currency", () => {
    expect(val(M.add(chf(100), chf(250))).minor).toBe(350);
    expect(val(M.subtract(chf(100), chf(250))).minor).toBe(-150);
    const e = error(M.add(chf(1), val(M.fromMinor(1, "EUR"))));
    expect(e._tag).toBe("CurrencyMismatch");
    expect(M.describeError(e)).toBe("Cannot combine CHF with EUR");
    expect(M.compare(chf(1), val(M.fromMinor(1, "EUR")))).toEqual({
      ok: false,
      error: e,
    });
  });

  it("sum folds with a typed failure", () => {
    expect(val(M.sum("CHF", [chf(1), chf(2), chf(3)])).minor).toBe(6);
    expect(val(M.sum("CHF", [])).minor).toBe(0);
    expect(error(M.sum("CHF", [chf(1), val(M.fromMinor(1, "USD"))]))._tag).toBe("CurrencyMismatch");
  });

  it("multiply rounds to minor units", () => {
    expect(val(M.multiply(chf(1000), 0.081)).minor).toBe(81);
    expect(val(M.multiply(chf(1005), 0.5)).minor).toBe(503);
    expect(val(M.multiply(chf(1005), 0.5, Math.floor)).minor).toBe(502);
    expect(error(M.multiply(chf(1), Infinity))._tag).toBe("InvalidAmount");
  });

  it("allocate never loses a minor unit", () => {
    expect(val(M.allocate(chf(100), [1, 1, 1])).map((p) => p.minor)).toEqual([34, 33, 33]);
    expect(val(M.allocate(chf(-100), [1, 1, 1])).map((p) => p.minor)).toEqual([-34, -33, -33]);
    expect(val(M.allocate(chf(5), [70, 30])).map((p) => p.minor)).toEqual([4, 1]);
    expect(error(M.allocate(chf(1), []))._tag).toBe("InvalidAllocation");
    expect(error(M.allocate(chf(1), [0, 0]))._tag).toBe("InvalidAllocation");
    expect(error(M.allocate(chf(1), [1, -1]))._tag).toBe("InvalidAllocation");
    expect(error(M.allocate(chf(1), [1, Number.POSITIVE_INFINITY]))._tag).toBe("InvalidAllocation");
    expect(M.describeError(error(M.allocate(chf(1), [])))).toContain("at least one ratio required");
  });
});

describe("wire", () => {
  it("decodes valid payloads", () => {
    expect(val(decodeDecimalWire({ amount: "12.50", currency: "CHF" })).minor).toBe(1250);
    expect(val(decodeDecimalWire({ amount: 12.5, currency: "CHF" })).minor).toBe(1250);
    expect(val(decodeMinorWire({ amount: 1250, currency: "CHF" })).minor).toBe(1250);
  });

  it("fails with a typed error that names the path", () => {
    const bad = error(decodeDecimalWire({ amount: "12.50", currency: "XYZ" }));
    expect(bad._tag).toBe("DecodeError");
    expect(bad.path).toBe("currency");
    expect(bad.reason).toContain("XYZ");

    expect(error(decodeDecimalWire({ amount: "12.505", currency: "CHF" })).path).toBe("amount");
    expect(error(decodeDecimalWire({ amount: false, currency: "CHF" })).path).toBe("amount");
    expect(error(decodeDecimalWire(null)).path).toBe("");
    expect(error(decodeDecimalWire({ amount: "1.00", currency: 42 })).path).toBe("currency");
    expect(error(decodeMinorWire({ amount: "1250", currency: "CHF" })).path).toBe("amount");
    expect(error(decodeMinorWire({ amount: Number.NaN, currency: "CHF" })).path).toBe("amount");
    expect(error(decodeMinorWire([])).path).toBe("");
  });

  it("round-trips", () => {
    expect(toDecimalWire(chf(-1250))).toEqual({ amount: "-12.50", currency: "CHF" });
  });
});
