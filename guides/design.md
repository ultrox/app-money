---
title: Design and guarantees
group: Guides
---

# Design and guarantees

The package treats money as a value object, not a floating-point number:

- `Money.minor` is always a safe integer.
- Every value carries a supported currency code.
- Values are immutable and created through checked constructors.
- Currency-mismatched arithmetic returns a typed error.
- Allocation preserves the exact input total, including negative amounts.
- Core operations do not throw for data errors.

`multiply` is the one operation that needs a rounding policy. It rounds to a minor unit with
`Math.round` by default and accepts a caller-provided function when the business rule differs.
Allocation has its own deterministic remainder rule: leftover minor units are assigned from left
to right.

The supported currency list is deliberately small and explicit. Add currencies only when the
domain needs them, and verify their ISO 4217 minor-unit digits at the same time.
