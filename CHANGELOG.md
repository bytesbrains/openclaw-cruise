# Changelog

## 0.0.1 — 2026-09-15

- Provider plugin scaffold: live `GET /v1/models` discovery with `x-cruise`
  pricing/limits projection (`@bytesbrains/openclaw-cruise-provider`).
- Tag-triggered release workflow (`release.yml`) with `npm run pack:check` so
  secrets stay out of the published artifact; a merge is not a publish.
- Public repo bootstrap: verified OpenClaw → Cruise recipe, contribution and
  security hygiene (gitleaks hooks, CI secrets scan, Dependabot), starter
  example under `examples/`.
