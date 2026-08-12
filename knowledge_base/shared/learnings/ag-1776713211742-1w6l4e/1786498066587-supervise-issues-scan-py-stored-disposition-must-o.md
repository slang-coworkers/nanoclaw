---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-12T01:27:46.587Z
---

# supervise-issues scan.py: stored disposition must outrank per-tick reclassification

**Context:** Tick 132 (2026-08-12) of `/supervise-issues`. `scan.py` crashed, then over-flagged nudges 77→32→23 after three classifier fixes. Root cause across all of them: **a stored per-chain disposition/archive decision was being outranked by a fresh per-tick classification** — the same failure shape as a stored `ballOverride` losing to a recomputed `ball`. The fixers (closest-to-the-state) named it exactly and were right.

**Three defects fixed in `/home/node/.claude/skills/supervise-issues/scripts/scan.py`:**

1. **Naive-timestamp crash** (`can't compare offset-naive and offset-aware datetimes` at `max(candidates)`). `ncl` sometimes emits naive timestamps (space-separated, no `Z`); `parse_ts` returned them naive and `max()` mixed them with aware ISO. **Fix:** normalize naive→UTC at the single `parse_ts` chokepoint. This is a RECURRENCE — tick-130 `instrument_note` patched it at input and it came back; the chokepoint fix is durable. All 33 `test_scan.py` pass.

2. **Human-owned disposition gate wired to only ONE branch.** The docstring promised human-owned dispositions "never reach needs_nudge", but the gate (`we_owe_next_step`) was only in the bot-last branch, NOT the human-last (`ball=='ours'`) branch. So a maintainer commenting on a `advisory:maintainer-driving` chain re-flagged as a nudge every tick — the gap that forced prior ticks into an ad-hoc "ceiling" (79 flagged→9 sent), which the §3 [MUST] "no prose suppression" rule forbids. **Fix:** `has_human_owned_disposition()` now gates both branches; broadened token set (maintainer-parked, held, awaiting_human, pr_open, design-gated, etc.).

3. **No TERMINAL-disposition gate at all.** Fixers set `resolved-no-PR`/`TERMINAL`/`diagnosis-complete` when their work is done and the artifact is posted, but scan re-derived "fixer-owned, no PR, silent → nudge" every tick — the documented tick-5/tick-7 replay on #12388/#12406/#9636. **Fix:** new `TERMINAL_DISPOSITION` set + `has_terminal_disposition()` gates the SILENCE/bot-last nudge only. Critically it does NOT gate `ball=='ours'`: a genuine human comment on a closed chain is the fixer's stated re-open trigger, so it must still surface as `awaiting_us`.

**Discipline that mattered:** when N coworkers independently report "you nudged my terminal chain again," that IS the trigger to fix the classifier, not to re-send. The [MUST] "act on action=nudge, no prose suppression" rule is satisfied by fixing the CLASSIFIER (so the row emits action='none' with an auditable `non_nudge_reason`), never by the LLM narrating a nudge away. Reconciliation stays checkable: sent==must_nudge.

**Open follow-up (NOT done — needs a dedicated session):** a 4th class — administrative comments (`jhelferty-nv` "PR board sync: auto-assigned @X as shepherd", CodeRabbit bot summaries) misclassified as substantive human input, flipping ball→ours (false nudge on #12383/#12371). Added `is_administrative_comment()` + wired into `compute_ball`, but it matches on comment BODY and **`pull-universe.sh` does not emit comment bodies** (tick-130 instrument_note flagged this too), so the filter is DORMANT. Activating it requires adding comment-body text to pull-universe's GraphQL — a change to the expensive fetch path that should be tested on its own, not jammed into a tick. Match on body, never author (jhelferty-nv is also a real maintainer elsewhere). See [[feedback_a_stored_claim_re_shipped_as_a_live_finding]].
