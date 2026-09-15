# AGENT.md — guidance for agents working in this repository

## What this is

Public **OpenClaw client** for [BytesBrains Cruise](https://bytesbrains.com/cruise): a verified
recipe today (`examples/openclaw.json5`, README), and (tracked in issues) a provider plugin that
discovers models from `GET /v1/models` instead of freezing a catalogue.

Cruise holds provider keys, project budgets, and the cost ledger. This repo only documents how
OpenClaw presents a `cru_` key to a Cruise base URL.

## Commands

```sh
npm ci                 # installs nothing much yet; runs prepare → core.hooksPath=.githooks
npm test               # gitleaks secrets scan (requires gitleaks on PATH)
npm run build          # validates examples/openclaw.json5 is present and Cruise-shaped
npm run secrets:scan   # same scan as test
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
- Branch Cruise refusals on `error.code` (`budget_exhausted`, `wallet_exhausted`,
  `measurement_stale`, …), not on HTTP status alone.
- A release is a **tag**, not a merge. There is no publish workflow until a plugin artifact
  exists; then it must be tag-triggered only.

## Layout

| Path | Role |
| --- | --- |
| `README.md` | User-facing recipe and refusal table |
| `examples/openclaw.json5` | Starter OpenClaw config (demo host) |
| `.githooks/` | pre-commit / pre-push gitleaks |
| `.gitleaks.toml` | Includes Cruise key shapes |
| `.github/workflows/ci.yml` | Required `check` job |

## Open work

See GitHub issues: verify the demo recipe (#1), live model discovery (#2), plugin publish (#3),
refusal docs (#4), upstream discoverability (#5), and repo posture (#7).
