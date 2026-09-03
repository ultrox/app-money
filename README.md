# app-money

[![npm version](https://img.shields.io/npm/v/%40ma.vu%2Fapp-money?logo=npm)](https://www.npmjs.com/package/@ma.vu/app-money)
[![CI](https://github.com/ultrox/app-money/actions/workflows/ci.yml/badge.svg)](https://github.com/ultrox/app-money/actions/workflows/ci.yml)
[![Bundle size (gzip)](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fultrox%2Fapp-money%2Fmain%2F.github%2Fbadges%2Fbundle-size.json)](https://github.com/ultrox/app-money#bundle-size-visibility)
[![CodeQL](https://github.com/ultrox/app-money/actions/workflows/codeql.yml/badge.svg)](https://github.com/ultrox/app-money/actions/workflows/codeql.yml)
[![Documentation](https://github.com/ultrox/app-money/actions/workflows/docs.yml/badge.svg)](https://ultrox.github.io/app-money/)

A small, exact Money value object for TypeScript. The core has no runtime dependencies: amounts are
stored as safe integer minor units, currencies are explicit, and operations that can fail return
typed `Result` values instead of throwing. An optional `@ma.vu/app-money/effect` entry point adds
Effect, Either, Schema, and collection adapters.

The package is ESM-only and targets ES2022.

## Quick start

Requirements: Node.js 22.21.1 for development and Corepack. The built package supports Node.js 20
and later.

```sh
corepack enable
pnpm install --frozen-lockfile
pnpm test
```

```ts
import { add, fromDecimal, toDecimalString } from "@ma.vu/app-money";

const subtotal = fromDecimal("12.50", "CHF");
const delivery = fromDecimal("3.00", "CHF");

if (subtotal.ok && delivery.ok) {
  const total = add(subtotal.value, delivery.value);
  if (total.ok) console.log(toDecimalString(total.value)); // "15.50"
}
```

For Effect applications, install the optional `effect` peer and import adapters separately so core
consumers never load it:

```ts
import { Effect } from "effect";
import { fromDecimal } from "@ma.vu/app-money/effect";

const amount = await Effect.runPromise(fromDecimal("12.50", "CHF"));
```

## Quality commands

| Command | Purpose |
| --- | --- |
| `pnpm test` | Run the Vitest suite once. |
| `pnpm test:watch` | Re-run only affected tests while editing. |
| `pnpm test:coverage` | Enforce thresholds and write HTML, LCOV, and JSON reports to `coverage/`. |
| `pnpm typecheck` | Run strict TypeScript checks without emitting files. |
| `pnpm lint` | Check lint rules, formatting, and import order with Biome. |
| `pnpm lint:fix` | Apply safe lint, formatting, and import-order fixes. |
| `pnpm build` | Build the minified ESM package and declarations in `dist/`. |
| `pnpm docs:build` | Build searchable API docs and guides in `.artifacts/docs/`. |
| `pnpm changeset` | Record the SemVer impact and release note for a consumer-visible change. |
| `pnpm size` | Build, print raw/gzip/Brotli sizes, and enforce the budget. |
| `pnpm package:check` | Validate exports, consumer types, and a real import of the built package. |
| `pnpm deadcode` | Find unused files, exports, and dependencies. |
| `pnpm security:audit` | Fail on known high- or critical-severity dependency advisories. |
| `pnpm check` | Run every local quality gate used by CI. |

Open `coverage/index.html` after `pnpm test:coverage` for line-by-line coverage. The current gates
require 100% line and function coverage, 99% statement coverage, and 95% branch coverage. In
addition to example tests, the suite generates 8,000 cases over round trips, allocations,
arithmetic, comparisons, and signs.

## Bundle-size visibility

`pnpm size` reports both built entry points in raw, gzip, and Brotli bytes. Hard limits live in
[`size-budget.json`](./size-budget.json), so budget changes are visible in code review.
It also refreshes the README badge with the current gzip sizes; CI fails if that badge is stale.

On every pull request, the Bundle size workflow builds both the base revision and the proposed
revision. Its GitHub job summary shows the exact Brotli delta and fails if the new bundle exceeds
the checked-in budget. The machine-readable reports are retained as CI artifacts for 14 days.

## Safety and transparency

- CI runs formatting/lint checks, strict types, tests, coverage thresholds, a production build,
  package export/type validation, a bundle budget, dead-code analysis, and a dependency audit.
- The built artifact is imported and exercised separately on Node.js 20.
- CodeQL analyzes every pull request and `main`, plus a weekly scheduled scan.
- Dependencies are exact, the pnpm lockfile is committed, install scripts are deny-by-default, and
  approved native installers are documented in `pnpm-workspace.yaml`.
- GitHub Actions are pinned to immutable commit SHAs; Dependabot proposes grouped npm and Actions
  updates weekly.
- The core declares no runtime dependencies, the Effect peer is optional, and both entry points are
  marked side-effect-free for tree shaking.
- Changesets creates a reviewable version/changelog pull request; after the one-time bootstrap, npm
  publishing uses OIDC trusted publishing with provenance, then creates the matching git tag and
  GitHub Release.

## Documentation and releases

The generated [documentation site](https://ultrox.github.io/app-money/) combines hand-written
guides with API reference for both the core and optional Effect entry points. It is rebuilt on every
pull request, generated from source, and deployed from `main`; generated HTML is never committed.

Consumer-visible changes include a small changeset file in the same pull request. See
[`guides/releasing.md`](./guides/releasing.md) for the reviewed release flow and one-time npm trusted
publisher setup.

## React Native adapter

[`examples/react-native/money-text.tsx`](./examples/react-native/money-text.tsx) shows an accessible
app-level `MoneyText` component. It intentionally stays outside the package because it imports the
host application's typography component and path aliases. Copy it into the host app and connect
its locale source there; the dependency-free domain package remains portable.

## Contributing and security

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the development flow. Please report vulnerabilities
privately as described in [SECURITY.md](./SECURITY.md).

## License

MIT
