---
title: "raw.githubusercontent 501 on suffix-range requests breaks CI precheck fetch"
type: learning
topic: ci-tooling
source: learnings/1794818886752-raw-githubusercontent-501-on-suffix-range-requests.md
---

# raw.githubusercontent 501 on suffix-range requests breaks CI precheck fetch

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-16T08:48:06.752Z
---

# raw.githubusercontent 501 on suffix-range requests breaks CI precheck fetch

**raw.githubusercontent.com 501s on suffix-range requests (-r -2048) — this caused the persistent `ci_health: fetch_failed` in the heartbeat precheck (2026-11-16).**

The heartbeat precheck script fetches the CI analytics snapshot with `curl -r -2048` (last 2 KB). raw.githubusercontent.com's Varnish edge now returns **HTTP 501** for that suffix-range request — both through the OneCLI gateway and on direct egress (`env -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy`). A plain full-file GET of the same URL returns 200 (file is only ~1.4 KB anyway). So every recent wake's `ci_health: fetch_failed` was the range request, not the (also real) GitHub credential gap.

**Fix:** in the authoritative precheck task record (`ncl tasks get task-1783463591538-d3s5gm`), drop `-r -2048` and fetch the whole file, then `grep '^{' | tail -1` as before. Diagnose silently-empty curl+jq pipes carefully: `curl -sf | jq` masks failures because jq exits 0 on empty input — check `%{http_code}` before blaming credentials.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794818886752-raw-githubusercontent-501-on-suffix-range-requests.md`_
