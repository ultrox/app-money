// Fowler's Money pattern, done the Railway way, with no dependencies.
// https://martinfowler.com/eaaCatalog/money.html
//
// Rules of this module:
//   * Amounts are integer minor units (rappen, cents, feninga). Never floats.
//   * Nothing here throws. Every operation that can fail returns a Result
//     with a tagged error you can pattern match on.
//   * Money is a frozen, branded value. The brand means the only way to get
//     one is through the constructors below, so a Money in hand is valid.
//   * Formatting is a function over Money, not a method, so it survives
//     arithmetic and can take a locale.

import { err, flatMap, map, ok, type Result } from "./result";

// ---------------------------------------------------------------------------
// Currencies. This is the whole registry. Add a line when the business adds a
// currency; symbols and names come from Intl (the OS), not from here.
// ---------------------------------------------------------------------------

export const CURRENCY_CODES = ["BAM", "CHF", "EUR", "USD"] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

/** ISO 4217 minor unit digits. */
const MINOR_DIGITS: Record<CurrencyCode, 0 | 2 | 3> = {
  BAM: 2,
  CHF: 2,
  EUR: 2,
  USD: 2,
};

export const isCurrencyCode = (u: unknown): u is CurrencyCode =>
  typeof u === "string" && (CURRENCY_CODES as ReadonlyArray<string>).includes(u);

export const minorDigits = (currency: CurrencyCode): number => MINOR_DIGITS[currency];

// ---------------------------------------------------------------------------
// Errors. Plain tagged unions; switch on `_tag`.
// ---------------------------------------------------------------------------

export type InvalidAmount = {
  readonly _tag: "InvalidAmount";
  readonly value: string | number;
  readonly reason: string;
};
export type CurrencyMismatch = {
  readonly _tag: "CurrencyMismatch";
  readonly left: CurrencyCode;
  readonly right: CurrencyCode;
};
export type InvalidAllocation = {
  readonly _tag: "InvalidAllocation";
  readonly ratios: ReadonlyArray<number>;
  readonly reason: string;
};
export type MoneyError = InvalidAmount | CurrencyMismatch | InvalidAllocation;

const invalidAmount = (value: string | number, reason: string): InvalidAmount => ({
  _tag: "InvalidAmount",
  value,
  reason,
});
const currencyMismatch = (left: CurrencyCode, right: CurrencyCode): CurrencyMismatch => ({
  _tag: "CurrencyMismatch",
  left,
  right,
});
const invalidAllocation = (ratios: ReadonlyArray<number>, reason: string): InvalidAllocation => ({
  _tag: "InvalidAllocation",
  ratios,
  reason,
});

/** Human-readable message for logging / dev tooling. */
export const describeError = (e: MoneyError): string => {
  switch (e._tag) {
    case "InvalidAmount":
      return `Invalid amount ${JSON.stringify(e.value)}: ${e.reason}`;
    case "CurrencyMismatch":
      return `Cannot combine ${e.left} with ${e.right}`;
    case "InvalidAllocation":
      return `Invalid allocation ratios: ${e.reason}`;
  }
};

// ---------------------------------------------------------------------------
// The type
// ---------------------------------------------------------------------------

declare const MoneyBrand: unique symbol;

export type Money = {
  /** Integer minor units. Negative means debit / refund / whatever you decide. */
  readonly minor: number;
  readonly currency: CurrencyCode;
  readonly [MoneyBrand]: true;
};

/** Internal: callers have already validated. */
const make = (minor: number, currency: CurrencyCode): Money =>
  Object.freeze({ minor: minor === 0 ? 0 : minor, currency }) as Money;

/** Structural guard for the rare place that receives a Money as `unknown`
 * (e.g. a schema adapter). */
export const isMoney = (u: unknown): u is Money =>
  typeof u === "object" &&
  u !== null &&
  Number.isSafeInteger((u as { minor?: unknown }).minor) &&
  isCurrencyCode((u as { currency?: unknown }).currency);

// ---------------------------------------------------------------------------
// Constructors
// ---------------------------------------------------------------------------

export const fromMinor = (minor: number, currency: CurrencyCode): Result<Money, InvalidAmount> =>
  Number.isSafeInteger(minor)
    ? ok(make(minor, currency))
    : err(invalidAmount(minor, "must be a safe integer number of minor units"));

export const zero = (currency: CurrencyCode): Money => make(0, currency);

/** Strict decimal: optional minus, digits, optional fraction. No exponents,
 * no thousands separators, no currency symbols. Clean that up before here. */
const DECIMAL = /^(-?)(\d+)(?:\.(\d*))?$/;

/**
 * Parse a decimal amount. Prefer strings from the wire; a number is accepted
 * but anything that isn't representable exactly (0.1 + 0.2, 1e21) is rejected
 * rather than silently rounded.
 */
export const fromDecimal = (
  value: number | string,
  currency: CurrencyCode,
): Result<Money, InvalidAmount> => {
  const digits = MINOR_DIGITS[currency];
  const text = typeof value === "number" ? String(value) : value.trim();
  const match = DECIMAL.exec(text);

  if (!match) return err(invalidAmount(value, "not a plain decimal number"));

  const [, sign, whole, frac = ""] = match;

  if (frac.length > digits) {
    return err(
      invalidAmount(value, `${currency} allows ${digits} decimal places, got ${frac.length}`),
    );
  }

  const magnitude = Number(whole + frac.padEnd(digits, "0"));
  return fromMinor(sign ? 0 - magnitude : magnitude, currency);
};

// ---------------------------------------------------------------------------
// Representation
// ---------------------------------------------------------------------------

/** Exact decimal string, e.g. "-1234.50". Use this for the wire and for inputs. */
export const toDecimalString = (m: Money): string => {
  const digits = MINOR_DIGITS[m.currency];
  const abs = Math.abs(m.minor)
    .toString()
    .padStart(digits + 1, "0");
  const whole = abs.slice(0, abs.length - digits);
  const frac = abs.slice(abs.length - digits);
  const sign = m.minor < 0 ? "-" : "";
  return digits === 0 ? `${sign}${whole}` : `${sign}${whole}.${frac}`;
};

/** Float for display libraries only (Intl). Never do math on this. */
export const toDecimal = (m: Money): number => m.minor / 10 ** MINOR_DIGITS[m.currency];

export type CurrencyDisplay = "symbol" | "narrowSymbol" | "code" | "name";

const formatters = new Map<string, Intl.NumberFormat>();

/**
 * Locale-aware formatting via Intl. de-CH gives "CHF 1’234.50",
 * bs-BA gives "1.234,50 KM", en-US gives "$1,234.50".
 * `locale` must be a valid BCP 47 tag; it comes from your own config, not
 * from the network, so a bad one is a programming error, not a runtime one.
 */
export const format = (m: Money, locale: string, display: CurrencyDisplay = "symbol"): string => {
  const key = `${locale}|${m.currency}|${display}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: m.currency,
      currencyDisplay: display,
    });
    formatters.set(key, formatter);
  }
  return formatter.format(toDecimal(m));
};

// ---------------------------------------------------------------------------
// Predicates and comparison
// ---------------------------------------------------------------------------

export const isZero = (m: Money): boolean => m.minor === 0;
export const isPositive = (m: Money): boolean => m.minor > 0;
export const isNegative = (m: Money): boolean => m.minor < 0;

export const equals = (a: Money, b: Money): boolean =>
  a.currency === b.currency && a.minor === b.minor;

const sameCurrency = (a: Money, b: Money): Result<CurrencyCode, CurrencyMismatch> =>
  a.currency === b.currency ? ok(a.currency) : err(currencyMismatch(a.currency, b.currency));

export const compare = (a: Money, b: Money): Result<-1 | 0 | 1, CurrencyMismatch> =>
  map(sameCurrency(a, b), () => (a.minor < b.minor ? -1 : a.minor > b.minor ? 1 : 0));

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

export const negate = (m: Money): Money => make(0 - m.minor, m.currency);

export const abs = (m: Money): Money => (m.minor < 0 ? negate(m) : m);

export const add = (a: Money, b: Money): Result<Money, CurrencyMismatch | InvalidAmount> =>
  flatMap(sameCurrency(a, b), (currency) => fromMinor(a.minor + b.minor, currency));

export const subtract = (a: Money, b: Money): Result<Money, CurrencyMismatch | InvalidAmount> =>
  flatMap(sameCurrency(a, b), (currency) => fromMinor(a.minor - b.minor, currency));

export const sum = (
  currency: CurrencyCode,
  items: Iterable<Money>,
): Result<Money, CurrencyMismatch | InvalidAmount> => {
  let acc: Result<Money, CurrencyMismatch | InvalidAmount> = ok(zero(currency));
  for (const item of items) {
    acc = flatMap(acc, (total) => add(total, item));
    if (!acc.ok) break;
  }
  return acc;
};

export type Rounding = (n: number) => number;

/**
 * Scale by a factor (VAT, discount, exchange rate). The result is rounded to a
 * minor unit with `round`; Math.round is half-up toward +infinity, which is
 * what most invoices expect. Pass Math.floor / Math.ceil or your own for
 * other policies. For splitting an amount into parts use `allocate`, which
 * never loses a minor unit.
 */
export const multiply = (
  m: Money,
  factor: number,
  round: Rounding = Math.round,
): Result<Money, InvalidAmount> => fromMinor(round(m.minor * factor), m.currency);

/**
 * Fowler's allocation: split an amount by ratios so the parts sum exactly to
 * the original. The remainder (at most one minor unit per part) is handed out
 * left to right.
 */
export const allocate = (
  m: Money,
  ratios: ReadonlyArray<number>,
): Result<ReadonlyArray<Money>, InvalidAllocation> => {
  if (ratios.length === 0) {
    return err(invalidAllocation(ratios, "at least one ratio required"));
  }
  if (ratios.some((r) => !Number.isFinite(r) || r < 0)) {
    return err(invalidAllocation(ratios, "ratios must be finite and non-negative"));
  }
  const total = ratios.reduce((s, r) => s + r, 0);
  if (total <= 0) {
    return err(invalidAllocation(ratios, "ratios must not all be zero"));
  }

  const shares = ratios.map((r) => Math.trunc((m.minor * r) / total));
  let remainder = m.minor - shares.reduce((s, x) => s + x, 0);
  const step = Math.sign(remainder);

  for (let i = 0; remainder !== 0; i = (i + 1) % shares.length) {
    shares[i] = (shares[i] ?? 0) + step;
    remainder -= step;
  }

  return ok(shares.map((minor) => make(minor, m.currency)));
};
