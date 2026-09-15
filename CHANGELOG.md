# Changelog

## 0.0.3 — 2026-09-15

First npm release since 0.0.1: `0.0.2` reached ClawHub but not npm.

- Fix the `release.yml` private guard: it tested `node -p`'s exit code (always 0), so every
  tag release failed before `npm publish` and `0.0.2` never reached npm (#21).
- ClawHub publishes only through `clawhub-publish.yml`; `release.yml` is npm-only, so the
  two workflows no longer race to push the same version.
- `release.yml` refuses a tag whose commit is not on `main`.
- Add `vite` as a dev dependency; vitest 5 needs it as a peer, and CI tests failed without it.
- `resolveCruiseDynamicModel` spreads `CRUISE_MODEL_COMPAT` instead of repeating its fields.
- Branch flow is enforced: PRs go into `dev` (Dependabot included), only `dev` may open a PR
  into `main` (`base-branch` check), and `v*` tags are protected (#23).

## 0.0.2 — 2026-09-15

- First release cut by the tag workflow: npm publish uses OIDC Trusted Publisher
  (pinned npm 11.5.1, optional `NPM_TOKEN` break-glass) instead of a long-lived token.
- README documents the live npm and ClawHub install paths.
- No provider code changes since 0.0.1.

## 0.0.1 — 2026-09-15

- Provider plugin: live `GET /v1/models` discovery with `x-cruise` pricing/limits
  projection (`@bytesbrains/openclaw-cruise-provider`).
- Published on [npm](https://www.npmjs.com/package/@bytesbrains/openclaw-cruise-provider)
  and [ClawHub](https://clawhub.ai/bytesbrains/plugins/openclaw-cruise-provider).
- Tag-triggered release workflows (`release.yml`, `clawhub-publish.yml`) with
  `npm run pack:check` so secrets stay out of the published artifact; a merge is
  not a publish.
- Public repo bootstrap: verified OpenClaw → Cruise recipe, contribution and
  security hygiene (gitleaks hooks, CI secrets scan, Dependabot), starter
  example under `examples/`.
