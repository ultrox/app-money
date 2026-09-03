/**
 * Opt-in Effect bridges and schemas. This is the only entry point that loads Effect; the core
 * package remains dependency-free.
 *
 * @module Effect
 */

import { Effect, Either, ParseResult, Schema } from "effect";
import * as M from "./money";
import type { Result } from "./result";
import {
  type DecodeError,
  decodeDecimalWire,
  decodeMinorWire,
  toDecimalWire,
  toMinorWire,
} from "./wire";

// ---------------------------------------------------------------------------
// Result <-> Effect bridges
// ---------------------------------------------------------------------------

export const toEither = <A, E>(r: Result<A, E>): Either.Either<A, E> =>
  r.ok ? Either.right(r.value) : Either.left(r.error);

export const toEffect = <A, E>(r: Result<A, E>): Effect.Effect<A, E> =>
  r.ok ? Effect.succeed(r.value) : Effect.fail(r.error);

/** Lift a Result-returning function into an Effect-returning one. */
export const lift =
  <Args extends ReadonlyArray<unknown>, A, E>(f: (...args: Args) => Result<A, E>) =>
  (...args: Args): Effect.Effect<A, E> =>
    toEffect(f(...args));

type Lifted<F> = F extends (...args: infer Args) => Result<infer A, infer E>
  ? (...args: Args) => Effect.Effect<A, E>
  : never;

// Effect-returning versions of every fallible operation. Errors keep their
// `_tag`, so Effect.catchTag / catchTags work on them unchanged.
export const fromMinor: Lifted<typeof M.fromMinor> = lift(M.fromMinor);
export const fromDecimal: Lifted<typeof M.fromDecimal> = lift(M.fromDecimal);
export const add: Lifted<typeof M.add> = lift(M.add);
export const subtract: Lifted<typeof M.subtract> = lift(M.subtract);
export const sum: Lifted<typeof M.sum> = lift(M.sum);
export const multiply: Lifted<typeof M.multiply> = lift(M.multiply);
export const allocate: Lifted<typeof M.allocate> = lift(M.allocate);
export const compare: Lifted<typeof M.compare> = lift(M.compare);

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/** Money as an opaque, already-valid value. Use this in domain-level schemas
 * (state, navigation params) where the value is Money on both sides. */
export const MoneySchema: Schema.Schema<M.Money> = Schema.declare(M.isMoney, {
  identifier: "Money",
  description: "Integer minor units plus an ISO 4217 code",
  pretty: () => (m) => `Money(${M.toDecimalString(m)} ${m.currency})`,
  equivalence: () => M.equals,
});

const wireIssue = (ast: Schema.Schema.Any["ast"], input: unknown, e: DecodeError) =>
  ParseResult.fail(
    e.path === ""
      ? new ParseResult.Type(ast, input, e.reason)
      : new ParseResult.Pointer(e.path, input, new ParseResult.Type(ast, input, e.reason)),
  );

type DecimalWireInput = { readonly amount: string | number; readonly currency: string };
type MinorWireInput = { readonly amount: number; readonly currency: string };

/** { amount: "12.50" | 12.5, currency: "CHF" } <-> Money */
export const MoneyFromDecimalWire: Schema.Schema<M.Money, DecimalWireInput> =
  Schema.transformOrFail(
    Schema.Struct({
      amount: Schema.Union(Schema.String, Schema.Number),
      currency: Schema.String,
    }),
    MoneySchema,
    {
      strict: true,
      decode: (wire, _options, ast) => {
        const r = decodeDecimalWire(wire);
        return r.ok ? ParseResult.succeed(r.value) : wireIssue(ast, wire, r.error);
      },
      encode: (m) => ParseResult.succeed(toDecimalWire(m)),
    },
  ).annotations({ identifier: "MoneyFromDecimalWire" });

/** { amount: 1250, currency: "CHF" } <-> Money */
export const MoneyFromMinorWire: Schema.Schema<M.Money, MinorWireInput> = Schema.transformOrFail(
  Schema.Struct({ amount: Schema.Number, currency: Schema.String }),
  MoneySchema,
  {
    strict: true,
    decode: (wire, _options, ast) => {
      const r = decodeMinorWire(wire);
      return r.ok ? ParseResult.succeed(r.value) : wireIssue(ast, wire, r.error);
    },
    encode: (m) => ParseResult.succeed(toMinorWire(m)),
  },
).annotations({ identifier: "MoneyFromMinorWire" });

// ---------------------------------------------------------------------------
// Collections. Money is a plain frozen object, not a Data.* value, so it does
// not implement Equal/Hash. For HashMap / HashSet keys use this.
// ---------------------------------------------------------------------------

export const key = (m: M.Money): string => `${m.currency}:${m.minor}`;

/** Equivalence for Array.dedupeWith, Stream.changesWith, etc. */
export const equivalence: (self: M.Money, that: M.Money) => boolean =
  Schema.equivalence(MoneySchema);
