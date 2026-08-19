---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-18T13:31:34.213Z
---

# supervise-issues scan.py naive-datetime crash froze state ~23h and produced a 115-nudge false surge

**Date:** 2026-08-18 (supervisor tick 173).

**Bug:** `scripts/scan.py` `parse_ts()` returned a *naive* datetime when a timestamp string lacked a `Z`/offset, so `compute_last_activity_by_us` → `max(candidates)` raised `TypeError: can't compare offset-naive and offset-aware datetimes` (session-dispatch ts is always aware). scan.py crashed with 0-byte output on EVERY tick. Because the tick is fed by an expensive `pull-universe.sh` (`gh` walk of 914 chains, ~19 min) piped straight into scan.py, the crash meant **no tick wrote `supervisor-state.json` or fired any nudge for ~23h** (state mtime froze).

**Fix (applied, 33 tests pass):** normalize in `parse_ts` — `if ts.tzinfo is None: ts = ts.replace(tzinfo=timezone.utc)`. All system timestamps are UTC per project rules.

**The recovery-tick trap:** the first clean scan after the outage flagged **115 rows `needs_nudge`** (`must_nudge=115`, `awaiting_us=109`) — ~25× a healthy tick. Firing them would have been destructive:
- Breakdown of the 115: 63 parked/terminal/no-reply, 36 other terminal long-tail, 9 actively-working, only 7 crashed. i.e. ~0 genuine "dead container needs a wake."
- `scan.py`'s `ball=ours` limb over-fires: a human GitHub comment we didn't reply *to on GitHub* keeps `ball=ours` forever; it does NOT detect that the owning session already reached a terminal decision **off**-GitHub (approver ABSTAIN recorded to ledger, fixer parked "nothing owed", reviewer verdict already delivered). Many chains had fixers explicitly refuting repeated stale nudges: "third identical supervisor nudge", "third re-fire of the same stale premise in ~36h".
- A `running` container that messaged the orchestrator 10 min ago (#12189) was still flagged, because `compute_last_activity_by_us` counts only GitHub events (R4), not a2a coordination — so a2a-active chains look GitHub-silent.

**Rule:** ⭐ A supervisor tick that flags an order-of-magnitude more nudges than usual is an **instrument-recovery backlog, not a workload** — treat SKILL.md §3's `sent_nudges != must_nudge` as the intended safety valve: HOLD the mass nudges, deliver the board, and **escalate to the operator** rather than mass-fire (which re-nudges refuted chains + wakes terminal sessions) or silently suppress. Verify the root cause (here: a crashed instrument + frozen state mtime) before characterizing the surge.

**Corollary:** the crashed sessions (`API Error 400 unexpected end of data line 1 column 775877`, `No conversation found`) are **oversized/lost transcripts** — a plain wake re-reads the same corrupt session and won't remedy it; these need operator/transcript intervention, not a nudge.
