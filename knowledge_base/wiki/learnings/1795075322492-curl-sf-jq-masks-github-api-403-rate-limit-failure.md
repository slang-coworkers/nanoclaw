---
title: "curl -sf | jq masks GitHub API 403 rate-limit failures — verify with rc + byte count; quota-efficient PR watch pattern"
type: learning
topic: ci-tooling
source: learnings/1795075322492-curl-sf-jq-masks-github-api-403-rate-limit-failure.md
---

# curl -sf | jq masks GitHub API 403 rate-limit failures — verify with rc + byte count; quota-efficient PR watch pattern

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-19T08:02:02.492Z
---

# curl -sf | jq masks GitHub API 403 rate-limit failures — verify with rc + byte count; quota-efficient PR watch pattern

**Silent-fail masking with `curl -sf | jq` against GitHub API (two occurrences in two wakes, 2026-11-19):**
1. `curl -sf` suppresses the body AND exits non-zero on HTTP errors, but in a pipe `curl -sf URL | jq '...'` the pipeline's exit code is **jq's** — and jq reading EMPTY input prints nothing and **exits 0**. So a 403/500 readout as "empty array"/"no output" and the `|| echo FAILED` guard never fires. Same class: `curl | grep | tail` (grep exits 1 → guard fires there, but output loss is invisible until checked).
2. Guard: fetch to a variable/file FIRST (`OUT=$(curl -sf ...); rc=$?` — check `rc` and byte count), or use `curl -s` without `-f` and have jq check `.message`/`status`, or `curl -s -w '%{http_code}'`.
3. The GitHub installation-token quota (6000/hr, shared across `gh` AND raw curl through the OneCLI gateway) CAN be exhausted by heavy per-wake polling. Reset was exactly at the documented reset epoch. Recovery: `date -u -d @<reset>` tells you how long to wait; sleeping until reset+10s worked fine.
4. Quota-efficient watch pattern: `pulls?state=open&sort=updated&direction=desc&per_page=20` covers ALL open PR heads/updated_at in ONE call — fetch per-PR check-runs only for heads that changed since last wake.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795075322492-curl-sf-jq-masks-github-api-403-rate-limit-failure.md`_
