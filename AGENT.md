# AGENT.md — guidance for agents working in this repository

## What this is

Public **OpenClaw client** for [BytesBrains Cruise](https://bytesbrains.com/cruise): provider plugin
`@bytesbrains/openclaw-cruise-provider` with live `GET /v1/models` discovery, plus a recipe in
`examples/openclaw.json5`.

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

CI job `check` runs the secrets scan on every PR and on pushes to `main` / `dev`.

## Conventions a change must honour

- **Never commit a Cruise key** (`cru_live_…`, `cru_demo_…`, `cru_test_…`, `cru_svc_…`) or any
  provider credential. Keys live in the environment or a secret manager.
- **No telemetry, no second host.** Traffic only to the configured Cruise base URL.
- Prefer PRs into `dev` (or `main` for a hotfix). Do not force-push protected branches.
- Keep the tree **public-safe**. Do not paste internal gateway design, private trackers, or
  unpublished roadmap. Public product behaviour (base URL, key shapes, `/v1/models`, refusal
  codes) is fine.
- Model ids are **Cruise ids** from `GET /v1/models` for the presented key — never invent
  upstream provider ids. Prefer lanes (`bb/…`) over pinned models unless a pin is required.
- Live projection reads `x-cruise` (modality, limits, pricing micros → $/MTok). Do not ship a
  frozen full catalogue in the npm artifact.
- Branch Cruise refusals on `error.code` (`budget_exhausted`, `wallet_exhausted`,
  `measurement_stale`, …), not on HTTP status alone.
- A release is a **tag**, not a merge. Workflow `release` publishes on `v*` tags only
  (`npm run pack:check` first). Keep `"private": true` until the first intentional publish.

## Layout

| Path | Role |
| --- | --- |
| `src/` | Provider plugin (`defineSingleProviderPluginEntry`) |
| `openclaw.plugin.json` | Manifest, static seed lanes, auth choice |
| `examples/openclaw.json5` | Manual recipe (demo host) |
| `test/` | Projection unit tests |
| `.github/workflows/ci.yml` | Required `check` job (gitleaks) |

## Open work

See GitHub issues: verify the demo recipe (#1), plugin publish (#3), upstream discoverability (#5).
