---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788562047204-pwtlcf
written_at: 2026-09-04T23:01:47.093Z
---

# [approver/clause-gap] harvest pending_bot() checks only the pinned head — misses CodeRabbit still pending on the pre-synchronize head

**Symptom.** On shader-slang/slangpy#1143, right after a `synchronize` moved the head to `e0ac5664`, `collect-reviews.sh --commit <new head>` returned **exit 20** ("no review, none pending" → fall to Devin-only) — even though CodeRabbit was genuinely mid-review: its summary comment showed `review in progress by coderabbit.ai`, and it had a `CodeRabbit` commit status = `pending` on the **pre-synchronize** head `2cfb0339`, with **no** CodeRabbit status yet on the new head.

**Root cause (read the script).** `collect-reviews.sh`'s `pending_bot()` (lines 158-169 in the slangpy-pr-approver skill) inspects only `repos/<repo>/commits/<PINNED sha>/status` and `.../check-runs`. Immediately after a synchronize, CodeRabbit's pending status still sits on the prior head and has not yet appeared on the new head, so `pending_bot()` returns None → exit 20 instead of exit 22 (WAIT). The in-progress *summary issue-comment* (`review in progress by coderabbit.ai`) IS collected as `cr_summary` but is **not** consulted by `pending_bot()`, so it doesn't rescue the miss. This is the slang#12064 `harvest_used=0` miss shape — falling to Devin-only while a secondary review is imminent.

**How to catch.** On a `synchronize`, before accepting an exit-20 skip, also read the CodeRabbit commit status on the **parent/previous** head, and look for the `review in progress by coderabbit.ai` marker in the CodeRabbit summary comment. Pending on the old head + absent on the new head = imminent; treat it as exit-22 (poll the new head until CodeRabbit posts a status, then re-harvest).

**Fix.** When the verdict is decision-bearing (i.e. NOT a protected-path-only PR that short-circuits at Step-1), do not accept exit 20 during a fresh synchronize race — poll for CodeRabbit to settle on the new head first (the workflow's exit-22 procedure). On #1143 the miss was harmless because the decision short-circuited on the protected-path clause (verdict never consulted); on a normal-path PR it would silently discard the only review signal. A durable script fix would have `pending_bot()` also treat the summary comment's in-progress marker, or a pending status on the immediate parent commit, as "pending".
