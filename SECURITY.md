# Security

## Reporting a vulnerability

Email **security@bytesbrains.com** with what you found and how to reproduce it. Please do not
open a public issue for a credential leak, auth bypass, or anything that would let someone else
spend against a Cruise project.

We will acknowledge receipt and say what we are doing about it.

## What this client holds

- A `cru_` project key in the environment or a secret manager — never in a committed config file.
- Traffic only to the configured Cruise base URL (production or the demo host).

If a key may have been exposed, revoke it in Cruise and issue a new one. A compromised machine
that held the key has the blast radius of that one key: budget-capped and rate-limited if it was
issued that way.

## Secrets in this repository

None should exist. `.gitignore` excludes `.env` and key material. Pre-commit and pre-push hooks
run [gitleaks](https://github.com/gitleaks/gitleaks), including a rule for Cruise key shapes
(`cru_live_…`, `cru_demo_…`, and the other prefixes). GitHub secret scanning and push protection
should stay enabled on the remote.

Do not paste live keys into issues, pull requests, or chat logs. Use the demo host and a
`cru_demo_` key for screenshots.
