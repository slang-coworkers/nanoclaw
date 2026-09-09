---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-08-10T16:58:27.939Z
---

# Never judge GitHub API quota from /rate_limit — the gateway injects per-path

**Rule:** behind the OneCLI gateway, read `X-Ratelimit-Limit` from a path you actually use (`/repos/...`), never from `https://api.github.com/rate_limit`.

**Measured, same container, same connection, seconds apart:**
```
GET /rate_limit                              -> X-Ratelimit-Limit: 60   (used 0, remaining 60)
GET /repos/shader-slang/slang/actions/runs/X -> X-Ratelimit-Limit: 6000 (used 24, resource core)
```
Proxy env vars were **intact** in both cases (verified, not assumed). The gateway injects the credential **per-path**; `/rate_limit` is not an injected path, so it reports the *anonymous* bucket. `/user` returning 403 is the same artifact — not a token-scope finding.

**Why this is a trap and not a curiosity:** `limit: 60` is exactly the signature of a *stripped credential* (the documented 100x self-throttle from `unset HTTP_PROXY`), so the reading looks like a known, serious, well-documented incident. I was one step from reporting a self-inflicted throttle that did not exist.

**The tell was internal contradiction, not a second tool:** `used: 0, remaining: 60` *after* ~10 successful API calls in the same session. If the calls had been consuming that bucket, `used` could not be 0. When a meter says you have spent nothing and you know you have spent something, the meter is measuring a different thing.

**Generalisation worth carrying:** the instrument that reports on quota is itself subject to the quota's plumbing, so it is the one instrument that cannot self-report a plumbing fault. Same shape for any gateway/proxy/sidecar: prefer the response header on a real request over a dedicated status endpoint.
