import fc from "fast-check";
import { describe, expect, it } from "vitest";
import * as M from "./money";
import type { Result } from "./result";
import { toMinorWire } from "./wire";

const value = <A, E>(result: Result<A, E>): A => {
  if (!result.ok) throw new Error(`expected success, got ${JSON.stringify(result.error)}`);
  return result.value;
};

const currency = fc.constantFrom(...M.CURRENCY_CODES);
const minor = fc.integer({ min: -1_000_000_000, max: 1_000_000_000 });

describe("money invariants", () => {
  it("round-trips every safe generated amount through the decimal wire format", () => {
    fc.assert(
      fc.property(minor, currency, (amount, code) => {
        const original = value(M.fromMinor(amount, code));
        const restored = value(M.fromDecimal(M.toDecimalString(original), code));

        expect(M.equals(restored, original)).toBe(true);
      }),
      { numRuns: 2_000 },
    );
  });

  it("preserves the total and currency for arbitrary valid allocations", () => {
    const ratios = fc
      .array(fc.integer({ min: 0, max: 1_000 }), { minLength: 1, maxLength: 12 })
      .filter((values) => values.some((ratio) => ratio > 0));

    fc.assert(
      fc.property(minor, currency, ratios, (amount, code, weights) => {
        const original = value(M.fromMinor(amount, code));
        const parts = value(M.allocate(original, weights));

        expect(parts).toHaveLength(weights.length);
        expect(parts.every((part) => part.currency === code)).toBe(true);
        expect(parts.reduce((total, part) => total + part.minor, 0)).toBe(amount);
      }),
      { numRuns: 2_000 },
    );
  });

  it("makes addition and subtraction inverse operations", () => {
    fc.assert(
      fc.property(minor, minor, currency, (left, right, code) => {
        const a = value(M.fromMinor(left, code));
        const b = value(M.fromMinor(right, code));
        const restored = value(M.subtract(value(M.add(a, b)), b));

        expect(M.equals(restored, a)).toBe(true);
      }),
      { numRuns: 2_000 },
    );
  });

  it("keeps comparison, signs, and minor-unit wire values consistent", () => {
    fc.assert(
      fc.property(minor, currency, (amount, code) => {
        const money = value(M.fromMinor(amount, code));

        expect(M.compare(money, M.zero(code))).toEqual({
          ok: true,
          value: Math.sign(amount),
        });
        expect(M.isZero(money)).toBe(amount === 0);
        expect(M.isPositive(money)).toBe(amount > 0);
        expect(M.isNegative(money)).toBe(amount < 0);
        expect(M.abs(money).minor).toBe(Math.abs(amount));
        expect(M.negate(M.negate(money))).toEqual(money);
        expect(M.toDecimal(money)).toBe(amount / 100);
        expect(toMinorWire(money)).toEqual({ amount, currency: code });
      }),
      { numRuns: 2_000 },
    );
  });
});
