---
title: Releasing
group: Maintainers
---

# Releasing

Releases are explicit and reviewable:

1. A consumer-visible pull request adds a changeset with `pnpm changeset`.
2. After merge, `release.yml` creates or updates the `Version Packages` pull request.
3. That pull request shows the exact version and `CHANGELOG.md` before publication.
4. Merging it publishes to npm, pushes the matching tag, and creates a GitHub Release.

## One-time repository setup

In GitHub, enable **Allow GitHub Actions to create and approve pull requests**. Create an `npm`
environment; optional reviewers on that environment become a final release approval gate. Set
GitHub Pages to use **GitHub Actions** as its source.

The npm trusted publisher must match:

- GitHub owner: `ultrox`
- Repository: `app-money`
- Workflow: `release.yml`
- Environment: `npm`

The publish job uses a GitHub-hosted runner, Node 24, npm 12.0.2, and `id-token: write`. No npm token
is needed after trusted publishing is active, and npm attaches provenance automatically.

## First-release bootstrap

npm only allows trusted publishing to be configured for a package that already exists. For the
first release, add a short-lived granular npm write token with bypass 2FA named `NPM_TOKEN` to the
GitHub `npm` environment. Merge the initial `Version Packages` pull request, then configure the
trusted publisher above, delete the secret, and revoke the token. Future releases authenticate
only with short-lived OIDC credentials.
