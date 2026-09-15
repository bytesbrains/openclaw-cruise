# Contributing

Thanks for caring about the OpenClaw client for Cruise. This repo is the public source of
truth for pointing OpenClaw at BytesBrains Cruise.

## Ground rules

- **Never commit a Cruise key** (`cru_live_…`, `cru_demo_…`, `cru_test_…`, `cru_svc_…`) or any
  provider credential. Keys live in the environment or a secret manager on the machine that uses
  them.
- **No telemetry, no second host.** The client talks only to the configured Cruise base URL.
- Prefer a pull request into `dev` (or `main` for a hotfix). Both branches are protected once CI
  is green.
- Keep this repository **public-safe**. Do not paste internal gateway design, private issue
  trackers, credentials, or unpublished roadmap from elsewhere. Public product behaviour
  (base URL, key shapes, `/v1/models`, refusal codes) is fine.

## Setup

```sh
git clone https://github.com/bytesbrains/openclaw-cruise.git
cd openclaw-cruise
```

`npm ci` (when a `package.json` is present) runs `prepare`, which points `core.hooksPath` at
`.githooks/`. **pre-commit** runs `gitleaks protect` on the staged diff; **pre-push** runs
`gitleaks detect` over full history — both with `.gitleaks.toml` (Cruise key shapes included).
Those hooks require [gitleaks](https://github.com/gitleaks/gitleaks) (`brew install gitleaks`)
and fail closed if it is missing — on purpose.

Until there is a Node package here, enable the hooks once after clone:

```sh
git config core.hooksPath .githooks
```

## Checks

```sh
npm run build          # TypeScript → dist/
npm test               # vitest projection tests
npm run check:recipe   # validates examples/openclaw.json5
npm run secrets:scan   # gitleaks secrets scan (requires gitleaks on PATH)
```

CI runs the secrets scan on every pull request and on pushes to `main` / `dev`. The required
status check is named `check`. Agent-oriented project notes live in [`AGENT.md`](AGENT.md).

## Trying the recipe

1. Point OpenClaw at the demo with a `cru_demo_` key — see [`README.md`](README.md) and
   [`examples/openclaw.json5`](examples/openclaw.json5).
2. Confirm `GET https://cruise-demo.bytesbrains.net/v1/models` lists the ids you put in
   `models.providers.cruise.models`.
3. Run a short OpenClaw session and confirm the demo ledger (or the person who issued the key)
   saw the requests.

## Releasing (maintainers)

A release is a **tag**, not a merge — same rule as the other Cruise public clients.

1. On `main`, bump `package.json` `version`, remove `"private": true`, update `CHANGELOG.md`.
2. Ensure `check` and `plugin` CI are green.
3. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`.
4. Workflow `.github/workflows/release.yml` runs `npm run pack:check`, then publishes to npm
   (`NPM_TOKEN`) and optionally ClawHub (`CLAWHUB_TOKEN`).

Never publish from a merge alone. Verify the packed tarball locally with
`npm run pack:check` before tagging.
