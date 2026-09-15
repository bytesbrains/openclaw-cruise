<p align="center">
  <img src="https://bytesbrains.com/brand/cruise-logo-480.png" alt="BytesBrains Cruise" width="280" />
</p>

<h1 align="center">BytesBrains Cruise for OpenClaw</h1>

<p align="center">
  Every model your Cruise key can reach — as an OpenClaw provider —<br />
  with budgets, per-project keys, and one cost ledger that stay on the gateway.
</p>

<p align="center">
  <a href="https://bytesbrains.com/cruise"><img src="https://img.shields.io/badge/Product-bytesbrains.com%2Fcruise-111111" alt="Product" /></a>
  <a href="https://docs.openclaw.ai/concepts/model-providers"><img src="https://img.shields.io/badge/OpenClaw-model%20providers-0A7" alt="OpenClaw docs" /></a>
</p>

---

## What this is

[BytesBrains Cruise](https://bytesbrains.com/cruise) is one OpenAI-compatible endpoint in front of
every model provider. This repository is the **OpenClaw client**: an installable provider plugin
that discovers models from `GET /v1/models` for your key, plus a verified recipe for manual config.

Your keys, budgets and ledger stay on the gateway. OpenClaw only holds a `cru_` key and talks to
the base URL you configure.

---

## Install the provider plugin (preferred)

The plugin (`@bytesbrains/openclaw-cruise-provider`) refreshes the model list from Cruise so you do
**not** hand-edit windows or costs from a screenshot. Costs and limits come from each row’s
`x-cruise` metadata. The two lane rows in `openclaw.plugin.json` are **offline seeds only**
(setup / no-auth fallback); live discovery replaces them when a key is present.

```sh
# From this checkout:
npm run build
openclaw plugins install .

# After a tagged release (see Releases below):
openclaw plugins install npm:@bytesbrains/openclaw-cruise-provider
# or: openclaw plugins install clawhub:@bytesbrains/openclaw-cruise-provider

export CRUISE_API_KEY=cru_demo_…   # or cru_live_…
openclaw gateway restart
openclaw models list --provider cruise
```

Onboarding can also take `--cruise-api-key`. Default production base URL is
`https://cruise.bytesbrains.net/v1`; point `models.providers.cruise.baseUrl` at
`https://cruise-demo.bytesbrains.net/v1` for the demo (must be `https` under
`*.bytesbrains.net`).

**Secrets never enter the published artifact** — only `dist/`, `openclaw.plugin.json`,
README, and the license. `npm run pack:check` (and gitleaks with `.gitleaks.toml` on the
extracted tarball) fail the release if a Cruise key shape appears. Keys stay in the
environment.

### Releases (maintainers)

A release is a **tag**, not a merge. Bump `package.json` version, update `CHANGELOG.md`,
merge to `main`, then:

```sh
git tag v0.1.0
git push origin v0.1.0
```

Two workflows fire on `v*`:

| Workflow | What it does | Secrets |
| --- | --- | --- |
| `release` | `pack:check` → **npm** publish (+ optional ClawHub via CLI) | npm OIDC Trusted Publisher (no token); optional `NPM_TOKEN` break-glass; `CLAWHUB_PUBLISH_TOKEN` optional |
| `clawhub-publish` | Official ClawHub reusable publish ([docs](https://docs.openclaw.ai/clawhub/publishing)) | `CLAWHUB_PUBLISH_TOKEN` |

**npm Trusted Publisher (one-time, after the first CLI publish):**

1. Open [npm package settings](https://www.npmjs.com/package/@bytesbrains/openclaw-cruise-provider) → **Trusted Publisher**.
2. GitHub: org `bytesbrains`, repo `openclaw-cruise`, workflow filename `release.yml`.
3. Allow `npm publish`. Later `v*` tags publish with OIDC (`id-token: write`) — no `NPM_TOKEN` required.

**First ClawHub publish (one-time):**

1. Create / claim the `@bytesbrains` owner on [clawhub.ai](https://clawhub.ai) (must match the package scope).
2. Locally: `npm i -g clawhub && clawhub login`
3. `npm run build && clawhub package validate . && clawhub package publish . --dry-run --owner bytesbrains --family code-plugin`
4. Put `CLAWHUB_PUBLISH_TOKEN` in a local `.env` (gitignored) and as the GitHub Actions secret of the same name.
5. Bump version, tag `v0.1.0` on `main`.

Install after it clears ClawHub review:

```sh
openclaw plugins install clawhub:@bytesbrains/openclaw-cruise-provider
```

After the first successful ClawHub publish you can enable secretless trusted publishing for
`workflow_dispatch` (tag pushes still want `CLAWHUB_PUBLISH_TOKEN` per ClawHub docs).

---

## Try it before anyone issues you a live key

1. Get a `cru_demo_` key from [bytesbrains.com/cruise](https://bytesbrains.com/cruise) (or whoever
   runs your BytesBrains demo).
2. Put the key in the environment — a shell profile or a secret manager, **not** a checked-in
   config file:

```sh
export CRUISE_API_KEY=cru_demo_…
```

3. Prefer the plugin path above. Or add a Cruise provider under `models.providers` (OpenClaw's
   OpenAI-completions path) by hand — point at the **demo** host first:

```json5
{
  env: { vars: { CRUISE_API_KEY: "cru_demo_…" } },
  agents: {
    defaults: {
      model: { primary: "cruise/bb/agentic-coding" },
    },
  },
  models: {
    mode: "merge",
    providers: {
      cruise: {
        baseUrl: "https://cruise-demo.bytesbrains.net/v1",
        apiKey: "${CRUISE_API_KEY}",
        api: "openai-completions",
        models: [
          // Prefer ids from GET /v1/models for your key — do not invent provider ids.
          {
            id: "bb/agentic-coding",
            name: "Cruise agentic coding (lane)",
            reasoning: true,
            input: ["text"],
            // Costs and windows: take them from GET /v1/models for the key you present.
            // Zeros here are placeholders so config validates; the gateway still meters.
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

A fuller starter lives in [`examples/openclaw.json5`](examples/openclaw.json5).

For real traffic, switch `baseUrl` to `https://cruise.bytesbrains.net/v1` and use a `cru_live_`
key the same way.

---

## Model ids

**Name the model as Cruise names it**, from `GET /v1/models` with your key — not as the upstream
provider does. A hardcoded `gpt-4o` reaches Cruise as a model it does not route.

A `bb/…` id is a **lane**: Cruise picks a member per request. Prefer a lane for agent work
(`bb/agentic-coding`); pin a specific model id only when you need that vendor.

OpenClaw currently wants each model declared in the provider's `models` array **unless** you use
the Cruise provider plugin above, which refreshes that list from `GET /v1/models`. Keep any
hand-written array short and refresh it from Cruise when lanes or measurements change.

---

## When Cruise refuses

Cruise answers spending refusals with HTTP `429` and OpenAI's `insufficient_quota` on purpose, so
stock OpenAI clients fail correctly. **Branch on `error.code`, never on HTTP status alone** — several
codes share `429` and mean different operator actions.

| Code | HTTP (typical) | Meaning | What to do |
| --- | --- | --- | --- |
| `budget_exhausted` | 429 | The **project** period cap is spent. Often carries `Retry-After`. | Wait for the period to reset, or ask the project owner to raise the cap. Retrying immediately will keep failing until then. |
| `wallet_exhausted` | 429 | The account **prepaid wallet** is empty. **No** useful `Retry-After` — waiting does not help. | Top up or get a credit grant. Do **not** retry in a loop. |
| `measurement_stale` | 429 | That model’s measurement aged out, so Cruise will not route it. | Call a lane (`bb/…`) or another id from `GET /v1/models` for your key. |
| `model_not_found` | 404 | No such model or lane, or nothing in the lane this key may reach. | Refresh ids from `GET /v1/models`. Do not invent upstream provider ids (`gpt-4o`, …). |
| `permission_error` | 403 | The key is valid but not scoped for that model. | Pick a model the key reaches, or ask for a wider key. |

**Period cap vs wallet empty:** both look like “out of quota” to a generic OpenAI client. OpenClaw
(or any agent) should read `error.code`: `budget_exhausted` is a **time-bound project limit**;
`wallet_exhausted` is **no prepaid balance left**. Confusing them leads to pointless retries or the
wrong human escalation.

Auth failures (`Missing bearer token`, `Incorrect API key`) use `type: authentication_error` and are
not spending refusals — fix the key or env wiring first.

---

## Ground rules for this client

- **Holds a `cru_` key, never a provider credential.** Blast radius is one revocable, budget-capped
  key.
- **Key in the environment / secret store, never in a committed config.** Settings sync and git
  history are how keys leak without an event to notice them by.
- **Traffic only to the configured Cruise base URL.** No telemetry, no second host.
- **Rehearse on the demo first.** `cruise-demo.bytesbrains.net` with a `cru_demo_` key costs
  nothing and holds no provider credential in the deployment.

---

## Product

| | |
| --- | --- |
| Product | [bytesbrains.com/cruise](https://bytesbrains.com/cruise) |
| Production API | `https://cruise.bytesbrains.net/v1` |
| Demo API | `https://cruise-demo.bytesbrains.net/v1` |
| OpenClaw docs | [Model providers](https://docs.openclaw.ai/concepts/model-providers) |

---

## Licence

See [`LICENSE.txt`](LICENSE.txt).
