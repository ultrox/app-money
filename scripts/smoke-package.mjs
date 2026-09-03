import assert from "node:assert/strict";
import { Effect } from "effect";
import { fromDecimal, toDecimalString } from "../dist/core/index.js";
import { fromDecimal as fromDecimalEffect } from "../dist/effect/index.js";

const result = fromDecimal("12.50", "CHF");

assert.equal(result.ok, true);
if (result.ok) {
  assert.equal(toDecimalString(result.value), "12.50");
}

const effectValue = await Effect.runPromise(fromDecimalEffect("3.00", "EUR"));
assert.equal(toDecimalString(effectValue), "3.00");

process.stdout.write("Package smoke test passed.\n");
