# AGENT.md — guidance for agents working in this repository

## What this is

Public **OpenClaw client** for [BytesBrains Cruise](https://bytesbrains.com/cruise): provider plugin
`@bytesbrains/openclaw-cruise-provider` with live `GET /v1/models` discovery, plus a recipe in
`examples/openclaw.json5`. Install from
[npm](https://www.npmjs.com/package/@bytesbrains/openclaw-cruise-provider) or
[ClawHub](https://clawhub.ai/bytesbrains/plugins/openclaw-cruise-provider).

Cruise holds provider keys, project budgets, and the cost ledger. This repo only ships the OpenClaw
side: present a `cru_` key to a Cruise base URL and project Cruise’s catalogue into OpenClaw models.

## Commands

```sh
npm ci                 # installs deps; prepare → core.hooksPath=.githooks
npm run build          # tsc → dist/
npm test               # vitest (projection / static catalog)
npm run check:recipe   # validates examples/openclaw.json5
npm run secrets:scan   # gitleaks (requires gitleaks on PATH)
```

CI jobs `check` (secrets scan) and `plugin` (build/test/recipe) run on every PR and on pushes to
`main` / `dev`.

## Conventions a change must honour

- **Never commit a Cruise key** (`cru_live_…`, `cru_demo_…`, `cru_test_…`, `cru_svc_…`) or any
  provider credential. Keys live in the environment or a secret manager.
- **No telemetry, no second host.** Traffic only to the configured Cruise base URL.
- **Open PRs with base `dev`** — features, fixes, docs and hotfixes alike. Only the `dev` → `main`
  release PR targets `main` (enforced by the `base-branch` check). Do not force-push `main` or
  `dev`.
- Keep the tree **public-safe**. Do not paste internal gateway design, private trackers, or
  unpublished roadmap. Public product behaviour (base URL, key shapes, `/v1/models`, refusal
  codes) is fine.
- Model ids are **Cruise ids** from `GET /v1/models` for the presented key — never invent
  upstream provider ids. Prefer lanes (`bb/…`) over pinned models unless a pin is required.
- Live projection reads `x-cruise` (modality, limits, pricing micros → $/MTok). Do not ship a
  frozen full catalogue in the npm artifact.
- Branch Cruise refusals on `error.code` (`budget_exhausted`, `wallet_exhausted`,
  `measurement_stale`, …), not on HTTP status alone.
- A release is a **tag on `main`**, not a merge. Workflow `release` publishes to npm on `v*` tags
  that point at `main` (`npm run pack:check` first); `clawhub-publish` publishes the same tag to
  ClawHub. Never create, move or delete a `v*` tag unless asked — see `CONTRIBUTING.md`.

## Layout

| Path | Role |
| --- | --- |
| `src/` | Provider plugin (`defineSingleProviderPluginEntry`) |
| `openclaw.plugin.json` | Manifest, static seed lanes, auth choice |
| `examples/openclaw.json5` | Manual recipe (demo host) |
| `test/` | Projection unit tests |
| `.github/workflows/ci.yml` | Required `check` (gitleaks) and `plugin` (build/test) jobs |
| `.github/workflows/branch-policy.yml` | Required `base-branch` job: PRs into `main` come from `dev` |
| `.github/workflows/release.yml` | npm publish on `v*` tags on `main` |
| `.github/workflows/clawhub-publish.yml` | ClawHub publish on `v*` tags |

## Open work

See GitHub issues: verify the demo recipe (#1), plugin publish (#3), upstream discoverability (#5).
