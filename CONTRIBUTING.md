# Contributing

## Development flow

1. Use the Node.js version in `.node-version` and enable Corepack.
2. Install exactly what the lockfile records with `pnpm install --frozen-lockfile`.
3. Run `pnpm test:watch` while developing.
4. Add a changeset with `pnpm changeset` for every consumer-visible change.
5. Run `pnpm check` before opening a pull request.

Keep changes small and include tests for behavior, failure paths, and important invariants. Treat
currency additions, rounding changes, parsing changes, public exports, and wire shapes as API
changes that require documentation.

## Coverage and size changes

Coverage thresholds are quality floors, not targets. A covered line still needs a meaningful
assertion. Open `coverage/index.html` to inspect missed branches.

Bundle growth may be valid, but it must be visible. Run `pnpm size` and explain material increases
in the pull request. Change `size-budget.json` only when the team deliberately accepts a new
budget; reviewers will see that change alongside the code.

## Package boundary

The core package is exported from `src/index.ts`; the opt-in Effect adapter is exported separately
from `src/money.effect.ts`. Application-specific UI adapters belong in `examples/` until their
dependencies and public contract are intentionally designed.

## Releases

Changesets records the release type and human-readable release note in the pull request that makes
the change. Choose `patch`, `minor`, or `major` based on the public contract; documentation and
internal-only changes may omit a changeset.

After changes reach `main`, the release workflow creates or updates a `Version Packages` pull
request. Merging that reviewed pull request publishes the exact version it contains, creates the
matching git tag, and creates a GitHub Release from `CHANGELOG.md`.

Publishing uses npm trusted publishing and provenance. See
[`guides/releasing.md`](./guides/releasing.md) for the one-time npm and GitHub configuration,
including the bootstrap required for a package that does not exist on npm yet.
