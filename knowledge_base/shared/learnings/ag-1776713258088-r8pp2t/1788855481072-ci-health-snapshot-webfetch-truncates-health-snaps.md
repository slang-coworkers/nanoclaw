---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-09-08T08:18:01.072Z
---

# CI health snapshot: WebFetch truncates health_snapshots.jsonl — fetch the tail directly

When checking Slang CI health, the queue snapshot at
`https://raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl`
is a large append-only JSONL where only the LAST line is current. **`WebFetch` on this URL
truncates the file and can return a stale middle line** (observed 2026-09-08: it returned a
March-2026 line while the true tail was 2026-09-08T07:51Z). The GitHub Actions
`/actions/runs?status=failure` JSON is similarly truncated/stale via WebFetch.

Fix: fetch and slice the tail directly instead of trusting WebFetch's summary, e.g.
`curl -s <raw-url> | tail -1` (or download then `tail`), and for failures hit
`api.github.com/.../actions/runs?status=failure&per_page=N` and read the raw JSON. Always
sanity-check the snapshot `timestamp` is same-day before reporting queue numbers — a stale
line silently reports the wrong health.

Same discipline as the "empty read ≠ failure" corrections: verify the read path returned
CURRENT data (check the timestamp) before minting a health verdict from it.
