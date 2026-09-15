---
title: "Root cause of the recurring 'slang workflow-failures stale-date' heartbeat anomaly: unbusted query gets a cached GitHub API response"
type: learning
topic: slang-compiler
source: learnings/1789391780211-root-cause-of-the-recurring-slang-workflow-failure.md
---

# Root cause of the recurring "slang workflow-failures stale-date" heartbeat anomaly: unbusted query gets a cached GitHub API response

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-14T13:16:20.211Z
---

# Root cause of the recurring "slang workflow-failures stale-date" heartbeat anomaly: unbusted query gets a cached GitHub API response

**Symptom (recurring across ~2 weeks of heartbeats):** `curl "https://api.github.com/repos/shader-slang/slang/actions/runs?status=failure&per_page=N"` through this container's egress path (OneCLI gateway) intermittently/often returns a **stale cached response** — e.g. on 2026-09-14 13:10 UTC it returned only failures from 2026-08-27 through 2026-08-31, even though genuine failures existed as recently as 13:07:56Z the same call was made. This matches every prior heartbeat-log entry describing the "known stale-date anomaly" in the `slang` workflow-failures precheck field.

**Root cause, confirmed by direct A/B test same wake:** the exact same query URL without a cache-buster returns the stale Aug-27→31 set every time; adding a cache-busting query param (`&_=$(date +%s%N)`) to the same endpoint immediately returns fresh, current data (verified: got results from minutes/seconds before the call). This strongly implicates a caching layer (likely the gateway/proxy sitting in front of `api.github.com` for this container) keying its cache on the literal query string, with a long-lived or possibly permanently-stuck cache entry for the un-busted URL.

**Fix / workaround:** always append a unique cache-busting param to GitHub REST API list/search-style GET calls made via `curl` in this environment, e.g.:
```
curl -sf "https://api.github.com/repos/OWNER/REPO/actions/runs?status=failure&per_page=10&_=$(date +%s%N)"
```
This is cheap and has no other side effects (GitHub ignores unknown query params). Recommend doing this for *any* GitHub REST API GET call in a heartbeat/precheck context where freshness matters, not just the workflow-runs endpoint — the same gateway cache could plausibly affect other endpoints too, untested.

**Action for the precheck script itself:** the heartbeat precheck script's `workflow_failures` curl calls (in the CLAUDE.md-documented heartbeat script) do NOT cache-bust — this is very likely why the anomaly has recurred for weeks. Worth proposing a precheck-script edit to add `&_=$(date +%s)` to those specific curl calls, which would fix the anomaly at the source instead of requiring every wake to re-derive it via a manual direct-fetch workaround.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789391780211-root-cause-of-the-recurring-slang-workflow-failure.md`_
