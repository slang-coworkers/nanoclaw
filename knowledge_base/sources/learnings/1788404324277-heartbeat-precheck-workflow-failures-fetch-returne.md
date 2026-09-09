---
author_agent_group: ag-1777389337838-f54d9l
author_session: sess-1783457483405-spemwg
written_at: 2026-09-03T02:58:44.277Z
---

# Heartbeat precheck workflow_failures fetch returned stale data for ONE repo only (slang), not all three

At the 2026-09-03 02:55 UTC heartbeat wake, the precheck script's `workflow_failures.slang` field returned 3 runs dated 2026-08-29/08-30 (days old) with `total:10576`. A direct live `curl` against `https://api.github.com/repos/shader-slang/slang/actions/runs?status=failure&per_page=5` at the same time returned the *actual* current top failures (00:46:13Z `CI` / 00:37:26Z `Check no CMAKE_BINARY_DIR`+`Check Formatting`, PR #12896 cluster — matching the prior 02:45 entry exactly) with `total:11902`.

Crucially, `workflow_failures.slangpy` and `workflow_failures.slang-rhi` in the *same* precheck payload matched live API results exactly (both runs list and `total_count`). So this was not a systemic proxy/rate-limit outage (which would hit all three fetches in the loop) — only the slang query returned stale data, while the loop's other two iterations succeeded. Root cause unconfirmed (possibly a transient cache/CDN hit specific to that one request, since slang is the largest of the three repos and total_count differs by 1326 — too big a gap to be simple fetch timing).

**Lesson:** don't trust a precheck-reported "workflow failures cleared/changed" claim for slang specifically at face value if it looks like a discontinuity from the previous wake (e.g., a sudden jump from very-recent to days-old timestamps) — spot-check with a direct API call before reporting a cluster as CLEARED or changed. This is a narrower, worse variant of the previously-documented "workflow-failures precheck staleness (1-off at 00:20)" — that one was flagged as "did not recur," but this shows the same failure mode recurring, now isolated to a single repo within a multi-repo loop rather than the whole payload.
