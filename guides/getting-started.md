---
title: Getting started
group: Guides
---

# Getting started

Install the core package:

```sh
pnpm add @ma.vu/app-money
```

Create values at system boundaries, then keep `Money` throughout domain logic:

```ts
import { add, fromDecimal, toDecimalString } from "@ma.vu/app-money";

const subtotal = fromDecimal("12.50", "CHF");
const delivery = fromDecimal("3.00", "CHF");

if (subtotal.ok && delivery.ok) {
  const total = add(subtotal.value, delivery.value);
  if (total.ok) console.log(toDecimalString(total.value)); // "15.50"
}
```

Amounts use safe integer minor units internally. Prefer decimal strings from JSON or forms;
`fromDecimal` rejects precision that cannot be represented instead of silently rounding it.

Use `toDecimalWire` or `toMinorWire` at outbound boundaries. The corresponding decoders accept
`unknown` and return a path-aware `DecodeError`, which makes them safe to use directly on API data.
