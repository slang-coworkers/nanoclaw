---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-15T12:54:22.479Z
---

# supervisor pull-universe dropped comment body, starving the board-sync administrative-comment filter

**Symptom (measured 2026-08-15, tick 167):** ~15 in-flight PR chains re-fired `awaiting_us` "human spoke last, unanswered" nudges every 12h tick, immune to coworker replies. Fixers/triager/pr-approver independently reported the same root cause across 9+ messages, citing the tell that the "~Nh unanswered" figure *walks* (47h→23h) while its anchor comment stays pinned days old — age recomputes each wake but the misclassification is fixed.

**Root cause (verified with own receipts, not relayed):** `jhelferty-nv` posts `<!-- pr-board-sync-assignment --> Automated notice (PR board sync) — do not reply` comments as GitHub `type=User` (a real maintainer account also used for automation). `scan.py` HAS the correct defense — `is_administrative_comment()` matches board-sync markers ("pr board sync", "auto-assigned", "as shepherd") on comment **body** (not author, since the account is also a human). But `scripts/pull-universe.sh` never fetched or emitted `body`: all 3 GraphQL comment selection sets requested only `author{login} createdAt`, and all 3 emit-dicts (`{author,at,is_bot[,kind]}`) omitted body. So `is_administrative_comment` always saw an empty body → returned False → the do-not-reply comment counted as a substantive human turn → `compute_ball` returned 'ours' → false nudge.

**The scan.py comment itself flagged this:** line 226-227 "Inert until pull-universe emits comment bodies; a missing body reads as non-administrative, preserving today's behavior." The filter was written correct-but-dormant, waiting on an upstream field that was never added.

**Fix:** added `body` to the 3 GraphQL selection sets (issue-arm, PR-arm, self-PR fragment) and the 3 emit-dict sites (issue-comment, pr-comment, REST-fallback + the issue-comment batch copy). Functional proof: same board-sync comment now yields `ball='human'` (with body) vs `ball='ours'` (without body). All 33 scan.py tests still pass. Genuine `jhelferty-nv` comments and real reviews (e.g. tangent-vector CHANGES_REQUESTED on #12421) are unaffected — they lack the markers, stay `awaiting_us`.

**Why:** A correctness filter matched on a field the data pipeline doesn't populate is dead code that reads as coverage. When a downstream classifier "has a filter for X" but X still leaks through, check whether the *producer* emits the field the filter reads — the guard can be perfect and inert simultaneously.

**How to apply:** When a supervisor/classifier defense exists but false positives persist, trace the field it keys on back to the producer. A body-based content filter is starved if the fetch layer only pulls metadata. Confirm end-to-end with a WITH-field vs WITHOUT-field functional diff, not just unit tests over synthetic inputs that already carry the field.
