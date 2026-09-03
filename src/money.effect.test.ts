import { Effect, Either, Exit, HashMap, Option, Pretty, Schema } from "effect";
import { describe, expect, it } from "vitest";
import * as M from "./money";
import * as ME from "./money.effect";

const chf = (minor: number) => {
  const r = M.fromMinor(minor, "CHF");
  if (!r.ok) throw new Error("bad fixture");
  return r.value;
};

// A realistic DTO. Money schemas compose like any other field.
const InvoiceLine = Schema.Struct({
  label: Schema.String,
  price: ME.MoneyFromDecimalWire,
  qty: Schema.Int,
});
const Invoice = Schema.Struct({
  id: Schema.String,
  currency: Schema.Literal(...M.CURRENCY_CODES),
  lines: Schema.Array(InvoiceLine),
});
type Invoice = typeof Invoice.Type;

const invoiceJson = {
  id: "inv-1",
  currency: "CHF",
  lines: [
    { label: "Consulting", price: { amount: "150.00", currency: "CHF" }, qty: 3 },
    { label: "Travel", price: { amount: 42.5, currency: "CHF" }, qty: 1 },
  ],
};

// Domain logic written once, in Effect, with typed failures.
const invoiceTotal = (inv: Invoice) =>
  Effect.gen(function* () {
    const lineTotals = yield* Effect.forEach(inv.lines, (l) => ME.multiply(l.price, l.qty));
    return yield* ME.sum(inv.currency, lineTotals);
  });

describe("schemas", () => {
  it("decodes a nested DTO into Money values", () => {
    const inv = Schema.decodeUnknownSync(Invoice)(invoiceJson);
    expect(M.isMoney(inv.lines[0]?.price)).toBe(true);
    expect(inv.lines[0]?.price.minor).toBe(15000);
    expect(inv.lines[1]?.price.minor).toBe(4250);
  });

  it("reports the failing path inside the DTO", () => {
    const r = Schema.decodeUnknownEither(Invoice)({
      ...invoiceJson,
      lines: [{ label: "x", price: { amount: "1.005", currency: "CHF" }, qty: 1 }],
    });
    expect(Either.isLeft(r)).toBe(true);
    if (Either.isLeft(r)) {
      expect(r.left._tag).toBe("ParseError");
      expect(r.left.message).toMatch(/lines.*0.*price.*amount/s);
      expect(r.left.message).toContain("decimal places");
    }
  });

  it("encodes back to the wire shape", () => {
    const wire = Schema.encodeSync(ME.MoneyFromDecimalWire)(chf(-1250));
    expect(wire).toEqual({ amount: "-12.50", currency: "CHF" });
  });

  it("MoneySchema is opaque and pretty-prints", () => {
    expect(Schema.is(ME.MoneySchema)(chf(1))).toBe(true);
    expect(Schema.is(ME.MoneySchema)({ minor: 1.5, currency: "CHF" })).toBe(false);
    expect(Pretty.make(ME.MoneySchema)(chf(1))).toBe("Money(0.01 CHF)");
    expect(ME.equivalence(chf(1), chf(1))).toBe(true);
    expect(ME.equivalence(chf(1), chf(2))).toBe(false);
  });

  it("round-trips the minor-unit wire schema and reports amount errors", () => {
    const money = Schema.decodeUnknownSync(ME.MoneyFromMinorWire)({
      amount: 1250,
      currency: "CHF",
    });
    expect(money).toEqual(chf(1250));
    expect(Schema.encodeSync(ME.MoneyFromMinorWire)(money)).toEqual({
      amount: 1250,
      currency: "CHF",
    });

    const invalid = Schema.decodeUnknownEither(ME.MoneyFromMinorWire)({
      amount: 1.5,
      currency: "CHF",
    });
    expect(Either.isLeft(invalid)).toBe(true);
    if (Either.isLeft(invalid)) expect(invalid.left.message).toContain("amount");
  });
});

describe("effects", () => {
  it("runs a typed money pipeline end to end", async () => {
    const program = Schema.decodeUnknown(Invoice)(invoiceJson).pipe(
      Effect.flatMap(invoiceTotal),
      Effect.map((total) => M.format(total, "de-CH")),
    );
    const out = await Effect.runPromise(program);
    expect(out).toMatch(/^CHF\s492\.50$/);
  });

  it("errors keep their _tag so catchTag works", async () => {
    const eur = M.fromMinor(100, "EUR");
    if (!eur.ok) throw new Error("bad fixture");

    const program = ME.add(chf(100), eur.value).pipe(
      Effect.catchTag("CurrencyMismatch", (e) => Effect.succeed(`mixed ${e.left}/${e.right}`)),
    );
    expect(await Effect.runPromise(program)).toBe("mixed CHF/EUR");
  });

  it("exposes every failure in the error channel", async () => {
    const program = ME.multiply(chf(100), Infinity);
    const exit = await Effect.runPromiseExit(program);
    expect(Exit.isFailure(exit)).toBe(true);
    // Type-level check: the error union is exactly InvalidAmount.
    const _typed: Effect.Effect<M.Money, M.InvalidAmount> = program;
    void _typed;
  });

  it("bridges both Result variants to Either", () => {
    const valid = M.fromMinor(1, "CHF");
    const invalid = M.fromMinor(1.5, "CHF");

    expect(Either.isRight(ME.toEither(valid))).toBe(true);
    expect(Either.isLeft(ME.toEither(invalid))).toBe(true);
  });

  it("provides Effect variants of every fallible operation", async () => {
    const one = await Effect.runPromise(ME.fromMinor(100, "CHF"));
    const two = await Effect.runPromise(ME.fromDecimal("2.00", "CHF"));

    expect((await Effect.runPromise(ME.subtract(two, one))).minor).toBe(100);
    expect((await Effect.runPromise(ME.allocate(two, [1, 1]))).map((part) => part.minor)).toEqual([
      100, 100,
    ]);
    expect(await Effect.runPromise(ME.compare(one, two))).toBe(-1);
  });

  it("works as a HashMap key via `key`", () => {
    const totals = HashMap.empty<string, number>().pipe(
      HashMap.set(ME.key(chf(100)), 1),
      HashMap.modify(ME.key(chf(100)), (n) => n + 1),
    );
    expect(Option.getOrNull(HashMap.get(totals, ME.key(chf(100))))).toBe(2);
  });
});
