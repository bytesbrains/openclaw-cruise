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
every model provider. This repository is the **OpenClaw client**: a verified recipe today, and
(tracked in issues) a provider plugin that discovers models from Cruise rather than freezing a list
into config.

Your keys, budgets and ledger stay on the gateway. OpenClaw only holds a `cru_` key and talks to
the base URL you configure.

---

## Try it before anyone issues you a live key

1. Get a `cru_demo_` key from [bytesbrains.com/cruise](https://bytesbrains.com/cruise) (or whoever
   runs your BytesBrains demo).
2. Put the key in the environment — a shell profile or a secret manager, **not** a checked-in
   config file:

```sh
export CRUISE_API_KEY=cru_demo_…
```

3. Add a Cruise provider under `models.providers` (OpenClaw's OpenAI-completions path). Point at
   the **demo** host first:

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

OpenClaw currently wants each model declared in the provider's `models` array. Fetching that list
from Cruise (so it cannot go stale) is tracked as an issue in this repo — until then, keep the
array short and refresh it from `GET /v1/models` when lanes or measurements change.

---

## When Cruise refuses

Cruise answers spending refusals with HTTP `429` and OpenAI's `insufficient_quota` on purpose, so
stock OpenAI clients fail correctly. Branch on `error.code`:

| Code | Meaning |
| --- | --- |
| `budget_exhausted` | The period cap is spent — wait for the next period (or raise the budget) |
| `wallet_exhausted` | The prepaid wallet is empty — add credit |
| `measurement_stale` | That model is not routable right now — pick another id from `/v1/models` |

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
