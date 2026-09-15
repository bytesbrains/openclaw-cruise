# Contributing

Thanks for caring about the OpenClaw client for Cruise. This repo is the public source of
truth for pointing OpenClaw at BytesBrains Cruise.

## Ground rules

- **Never commit a Cruise key** (`cru_live_…`, `cru_demo_…`, `cru_test_…`, `cru_svc_…`) or any
  provider credential. Keys live in the environment or a secret manager on the machine that uses
  them.
- **No telemetry, no second host.** The client talks only to the configured Cruise base URL.
- Open every pull request (features, fixes, docs, hotfixes) **into `dev`**. Only the release
  PR from `dev` targets `main`. See [Branches and releases](#branches-and-releases).
- Keep this repository **public-safe**. Do not paste internal gateway design, private issue
  trackers, credentials, or unpublished roadmap from elsewhere. Public product behaviour
  (base URL, key shapes, `/v1/models`, refusal codes) is fine.

## Setup

```sh
git clone https://github.com/bytesbrains/openclaw-cruise.git
cd openclaw-cruise
```

`npm ci` runs `prepare`, which points `core.hooksPath` at `.githooks/`. **pre-commit**
runs `gitleaks protect` on the staged diff; **pre-push** runs `gitleaks detect` over full
history — both with `.gitleaks.toml` (Cruise key shapes included). Those hooks require
[gitleaks](https://github.com/gitleaks/gitleaks) (`brew install gitleaks`) and fail closed
if it is missing — on purpose.

Published package: [`@bytesbrains/openclaw-cruise-provider`](https://www.npmjs.com/package/@bytesbrains/openclaw-cruise-provider)
([ClawHub](https://clawhub.ai/bytesbrains/plugins/openclaw-cruise-provider)).

## Checks

```sh
npm run build          # TypeScript → dist/
npm test               # vitest projection tests
npm run check:recipe   # validates examples/openclaw.json5
npm run secrets:scan   # gitleaks secrets scan (requires gitleaks on PATH)
```

CI runs the secrets scan (`check`) and build/test/recipe (`plugin`) on every pull request and on
pushes to `main` / `dev`. Agent-oriented project notes live in [`AGENT.md`](AGENT.md).

## Trying the recipe

1. Point OpenClaw at the demo with a `cru_demo_` key — see [`README.md`](README.md) and
   [`examples/openclaw.json5`](examples/openclaw.json5).
2. Confirm `GET https://cruise-demo.bytesbrains.net/v1/models` lists the ids you put in
   `models.providers.cruise.models`.
3. Run a short OpenClaw session and confirm the demo ledger (or the person who issued the key)
   saw the requests.

## Branches and releases

```text
feature/fix/deps ──PR──▶ dev ──release PR──▶ main ──tag vX.Y.Z──▶ npm + ClawHub
```

| Branch | Takes PRs from | Required checks | Notes |
| --- | --- | --- | --- |
| `dev` | any branch (incl. Dependabot) | `check`, `plugin` | Integration branch |
| `main` | `dev` only | `check`, `plugin`, `base-branch`, 1 approval, up to date | Release branch |

Both branches are protected: no force-push, no deletion. `base-branch`
(`.github/workflows/branch-policy.yml`) fails any PR into `main` whose head is not this repo's
`dev`. `v*` tags are protected by the `release-tags` ruleset: only admins can create them, and
nobody can move or delete one.

A release is a **tag**, not a merge — same rule as the other Cruise public clients.

1. In a PR into `dev`, bump `package.json` `version` and move `CHANGELOG.md`'s `Unreleased`
   notes under the new version.
2. Open the release PR `dev` → `main` titled `Release X.Y.Z`; merge once `check`, `plugin` and
   `base-branch` are green.
3. Tag the merge commit on `main` and push:
   `git checkout main && git pull && git tag vX.Y.Z && git push origin vX.Y.Z`.
4. `release.yml` checks the tag matches `package.json` and points at a commit on `main`, runs
   `npm run pack:check`, then publishes to npm via OIDC Trusted Publisher (optional break-glass
   `NPM_TOKEN`). `clawhub-publish.yml` publishes the same tag to ClawHub
   (`CLAWHUB_PUBLISH_TOKEN`).
5. After the release, confirm `dev` and `main` point at the same tree. If `main` moved on its own
   (an admin bypass), open a PR `main` → `dev` to sync before the next feature lands.

Never publish from a merge alone, and never move a published tag — cut the next patch version
instead. Verify the packed tarball locally with `npm run pack:check` before tagging.
