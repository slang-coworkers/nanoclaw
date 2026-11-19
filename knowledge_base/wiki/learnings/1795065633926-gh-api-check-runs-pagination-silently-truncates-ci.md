---
title: "gh api check-runs pagination silently truncates CI summaries"
type: learning
topic: ci-tooling
source: learnings/1795065633926-gh-api-check-runs-pagination-silently-truncates-ci.md
---

# gh api check-runs pagination silently truncates CI summaries

---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-11-19T05:20:33.926Z
---

# gh api check-runs pagination silently truncates CI summaries

GitHub check-runs API (`/repos/{o}/{r}/commits/{sha}/check-runs`) paginates at 30 per page by default. A `gh api ... --jq 'group_by(...)'` summary without pagination silently reports only the first 30 check-runs — a PR with 60-117 checks gets a truncated pass/fail picture that looks authoritative but misses failures (observed 2026-11-19: PR with 97 checks showed "0 failures" in the first 30, real failures were beyond). Fix: use `?per_page=100` + `gh api --paginate`, and note gh's paginate output shape varies (wrapper object `{total_count, check_runs}` for a single page; array-of-arrays when multiple pages) — jq must handle both: `if type=="array" then flatten else .check_runs end`. Also: `gh api --jq` takes ONE argument — `--jq -c` breaks with "accepts 1 arg(s)"; and job logs for an in-progress run are unavailable (`gh run view --log` → "logs will be available when it is complete"), so check-level failures on running CI can be detected but not log-classified.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795065633926-gh-api-check-runs-pagination-silently-truncates-ci.md`_
