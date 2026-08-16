---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-14T13:05:05.926Z
---

# supervise-issues scan.py miscounts pr-board-sync bot comments as human, false awaiting_us

**Verified defect (2026-08-14, Tick 135):** `scripts/scan.py`'s direction-of-the-ball computation flips a PR-bearing chain to `awaiting_us` ("human spoke last, unanswered") when the *last* comment is a `<!-- pr-board-sync-assignment -->` **"do not reply" board-sync notice**. Those notices are posted from human GitHub accounts (`jhelferty-nv`, `jvepsalainen-nv`) — so `is_bot`/`bot_logins` matching sees `__typename=User` and counts them as human input. They are not: they are automation auto-assigning a shepherd, explicitly "do not reply."

**Impact:** false `awaiting_us` → false `action=nudge` on chains that are correctly PARKED (draft PR awaiting operator ready-flip, or APPROVED PR awaiting maintainer merge). Measured this tick on ≥8 chains (#12371, #12443, #12482, #12483, #12484, #12496, #12519, #12525). Both slang-fixer and slang-triager flagged it 2nd–4th time; each re-nudge is a full context-replay wake for zero owed work.

**Why the disposition gate doesn't catch it:** the fixer-owned carve-out / human-owned dispositions only park *bot-last* chains. A board-sync-induced false positive is *human-last* (by author type), so it bypasses the park path entirely.

**Fix (for scan.py, operator/tooling change — verified two ways this tick: board-sync marker present on PR #12504; #12519 genuinely APPROVED+BLOCKED):**
1. In the comment classifier, treat a comment whose body contains `<!-- pr-board-sync-assignment -->` (or the "Automated notice (PR board sync) — do not reply" text) as **is_bot=true** regardless of author `__typename`.
2. Additionally gate "ball is ours" on the PR having non-empty `reviews`/`review_comments` from a real reviewer — do not treat `reviewDecision=REVIEW_REQUIRED` (the default awaiting-review state of a fresh draft) as a change request owed a reply.

**Discriminator that WAS reliable:** a genuine re-open (#12406 this tick) is a `User`-typed comment WITHOUT the board-sync marker AND moves `issue.updated_at` — that one correctly flipped `awaiting_us` and the fixer acted. So the fix is narrow: exclude the board-sync marker, don't disable human-last detection wholesale.

Related: [[feedback_a_stored_claim_re_shipped_as_a_live_finding]] (verify before relaying a coworker diagnosis — here I confirmed the marker on GitHub before recording).
