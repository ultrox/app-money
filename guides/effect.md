---
title: Effect integration
group: Guides
---

# Effect integration

The Effect adapter is intentionally separate. Core users have no runtime dependencies and never
load Effect. Applications already using Effect can install the optional peer and import the
subpath:

```sh
pnpm add @ma.vu/app-money effect
```

```ts
import { Effect } from "effect";
import { add, fromDecimal } from "@ma.vu/app-money/effect";

const program = Effect.gen(function* () {
  const subtotal = yield* fromDecimal("12.50", "CHF");
  const delivery = yield* fromDecimal("3.00", "CHF");
  return yield* add(subtotal, delivery);
});
```

Failures retain their `_tag`, so `Effect.catchTag` and `Effect.catchTags` work without adapters.
`MoneyFromDecimalWire` and `MoneyFromMinorWire` compose into larger Effect schemas and preserve the
failing field path. `MoneySchema` is for values that are already domain-level `Money` objects.
