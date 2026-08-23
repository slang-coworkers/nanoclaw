---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-22T12:41:01.318Z
---

# supervise-issues scan.py over-flags nudges: bots tagged is_bot=false + board-sync notices read as human-last

**Symptom:** A /supervise-issues tick produced `must_nudge=182` (174 `awaiting_us` + 8 escalate) against a prior tracker where those chains were parked as `awaiting_human`/`advisory:maintainer-driving`. Firing all 182 would have spammed dozens of maintainer-driven chains and bot-last chains with fixer nudges — a fleet-scale, credibility-damaging action.

**Root cause — FOUR independent classification defects, all upstream of the `action='nudge'` field the skill says to trust blindly:**

1. **Review bots tagged `is_bot=False`.** `pull-universe.sh` records `github-actions[bot]` and `coderabbitai[bot]` reviews/comments with `is_bot=false`. `scan.py::is_bot_author` trusts the per-comment `is_bot` field over `bot_logins` (which defaults to only `nv-slang-bot`). So a bot review as the newest actor → "human spoke last" → false `awaiting_us`. Measured: 25 of 140 human-last nudges.
2. **`pr-board-sync-assignment` automated notices counted as human speech.** The account `jhelferty-nv` posts automated board-sync comments whose body literally says *"Automated notice … do not reply to this comment."* `compute_ball` sees a non-bot login as newest actor → ball ours. This was the single largest false-positive source among "fresh" candidates.
3. **Maintainer↔maintainer @-assignments read as ball-ours.** Comments like `@jkwak-work assigning to you` / `@kaizhangNV @szihs not sure which of you` / `@0xivanm thanks for your interest` are maintainers talking to each other or to external contributors, not requests to us. `compute_ball` treats any non-bot last actor as "we owe a reply."
4. **Phantom/malformed keys + running-container rows not excluded.** Escalate set included `#2` (×2), `#61`, `#72` (misparsed) and `#12371` (flagged PHANTOM malformed key); 3 "fresh" candidates (#12558/#12581/#12668) had running containers scan should have excluded.

**Net:** of 182, **zero** were a fresh+correct+unactioned nudge. The one genuine ball-in-court chain (slangpy #1117 — jhelferty wrote `@nv-slang-bot your PR framing is wrong`) had **already been nudged the same tick**.

**How to apply:**
- **Do NOT blindly fire scan.py's `action='nudge'` set when its size jumps fleet-wide vs. the prior parked tracker.** The skill's "act on every nudge row, prose is not suppression" MUST-rule assumes the classifier is sound; when the classifier itself is provably defective, the correct move is escalate the instrument defect, send only the receipts-verified nudges, and report `sent < must_nudge` with the defect named — not fire 182 known-bad messages.
- **Fix forward:** add `github-actions`, `coderabbitai` (and any `*[bot]`) to `DEFAULT_BOT_LOGINS` in scan.py; have `pull-universe.sh` set `is_bot=true` for `[bot]`-suffixed logins and known bot accounts; filter `pr-board-sync-assignment` (and any `<!-- ... -->` HTML-comment automated notices) out of the ball computation; make `compute_ball` require the human comment to actually address us (bot @-mention, or a change-request review on our own `fix/issue-` PR) before flipping to `awaiting_us`.
- **Verify before mass-dispatch:** sample the newest actual comment body via `gh` on a handful of `awaiting_us` rows; if they're board-sync notices or maintainer cross-assignments, the whole flip is suspect.

Ties to [[feedback_mechanism_must_predict_observed_coordinates]] (an over-stated refutation licenses a bad decision) and the Tick-86 disposition-rehydration over-flag noted in the skill.
