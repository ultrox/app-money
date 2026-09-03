// The boundary. `unknown` goes in, Money or a typed DecodeError comes out.
// No parser library; if you want to compose this into a bigger schema, wrap
// it in a one-line adapter (see README section in the reply).

import {
  CURRENCY_CODES,
  type CurrencyCode,
  describeError,
  fromDecimal,
  fromMinor,
  isCurrencyCode,
  type Money,
  toDecimalString,
} from "./money";
import { err, ok, type Result } from "./result";

export type DecodeError = {
  readonly _tag: "DecodeError";
  /** Where in the input it went wrong, e.g. "currency" or "amount". */
  readonly path: string;
  readonly reason: string;
  readonly input: unknown;
};

const decodeError = (path: string, reason: string, input: unknown): DecodeError => ({
  _tag: "DecodeError",
  path,
  reason,
  input,
});

// ---------------------------------------------------------------------------
// Wire shapes. Adjust to what your API actually sends; this file is the ONLY
// place that knows about it.
// ---------------------------------------------------------------------------

/** { "amount": "12.50", "currency": "CHF" }  (also accepts a JSON number) */
export type DecimalWire = { readonly amount: string | number; readonly currency: CurrencyCode };

/** { "amount": 1250, "currency": "CHF" }  (integer minor units) */
export type MinorWire = { readonly amount: number; readonly currency: CurrencyCode };

const isRecord = (u: unknown): u is Record<string, unknown> =>
  typeof u === "object" && u !== null && !Array.isArray(u);

const readCurrency = (input: Record<string, unknown>): Result<CurrencyCode, DecodeError> =>
  isCurrencyCode(input["currency"])
    ? ok(input["currency"])
    : err(
        decodeError(
          "currency",
          `expected one of ${CURRENCY_CODES.join(", ")}, got ${JSON.stringify(input["currency"])}`,
          input,
        ),
      );

// ---------------------------------------------------------------------------
// Decoders
// ---------------------------------------------------------------------------

export const decodeDecimalWire = (input: unknown): Result<Money, DecodeError> => {
  if (!isRecord(input)) return err(decodeError("", "expected an object", input));

  const currency = readCurrency(input);
  if (!currency.ok) return currency;

  const amount = input["amount"];
  if (typeof amount !== "string" && typeof amount !== "number") {
    return err(decodeError("amount", "expected a string or number", input));
  }

  const money = fromDecimal(amount, currency.value);
  return money.ok ? money : err(decodeError("amount", describeError(money.error), input));
};

export const decodeMinorWire = (input: unknown): Result<Money, DecodeError> => {
  if (!isRecord(input)) return err(decodeError("", "expected an object", input));

  const currency = readCurrency(input);
  if (!currency.ok) return currency;

  const amount = input["amount"];
  if (typeof amount !== "number") {
    return err(decodeError("amount", "expected a number", input));
  }

  const money = fromMinor(amount, currency.value);
  return money.ok ? money : err(decodeError("amount", describeError(money.error), input));
};

// ---------------------------------------------------------------------------
// Encoders (cannot fail: a Money is valid by construction)
// ---------------------------------------------------------------------------

export const toDecimalWire = (m: Money): DecimalWire => ({
  amount: toDecimalString(m),
  currency: m.currency,
});

export const toMinorWire = (m: Money): MinorWire => ({
  amount: m.minor,
  currency: m.currency,
});
