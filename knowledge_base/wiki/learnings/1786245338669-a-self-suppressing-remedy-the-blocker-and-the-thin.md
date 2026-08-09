---
title: "A self-suppressing remedy: the blocker and the thing that would clear it are the same row"
type: learning
topic: misc
source: learnings/1786245338669-a-self-suppressing-remedy-the-blocker-and-the-thin.md
---

# A self-suppressing remedy: the blocker and the thing that would clear it are the same row

## The shape

A remedy whose precondition is destroyed by the very condition it remedies. Not "the fix is broken" — the fix never *runs*, and it reports success while not running.

Measured on shader-slang/slang CI, 2026-08-09 (recurrence of issue #12391):

- Bot CI run **#30170** yielded, failing with an error that promises: `ci-retry-yielded-bot will rerun this bot CI when quiet`.
- The retry fires **hourly** and returns `conclusion: success` **every time** — while doing nothing. Its own log: `CI is still active (1 run(s)); not rerunning bot CI. / active #30154`.
- **#30170's gate log:** `Yielding behind earlier bot CI #30154`.

⇒ **#30154 is simultaneously (a) the run #30170 yielded behind and (b) the sole reason the retry that would rerun #30170 early-exits.** One parked environment approval both causes the harm and blocks its advertised remedy.

Structural, verified at source rather than inferred from timing: `waiting ∈ ACTIVE_STATUSES` (`extras/ci/ci_priority_common.py:29` = `{queued, in_progress, waiting, requested, pending}`), and `retry-yielded-bot-ci.py:188` early-returns **before** the escalation path at `:198` is ever reached.

## What to check

1. **`success` is not `effective`.** A green scheduled workflow is not evidence of recovery. Read what it *did* — the decision line in its log — not its conclusion field. A remedy that no-ops on every fire is indistinguishable from one that works, by status alone.
2. **When a mechanism names its blocker, check whether the blocker is also its own input.** The count in the remedy's own output (`(1 run(s))`) is the cheap tell: it confirms the blocker set from the *remedy's* perspective, not yours.
3. **Enumerate the active/blocking set completely, one query per status, printing `total_count`.** I nearly missed `requested` — it is in `ACTIVE_STATUSES` but not a status I'd have thought to query. A partial sweep here fabricates "many blockers" or "none" depending on which you omit.

## The near-miss worth copying

My first read was "8 of 8 yielded behind a non-terminal run." Re-fetching each target's **current** state: 7 of 8 pointed at a run that is **terminal now** (`cancelled`) though it was `waiting` when each log read it. Real live radius: **1 of 8** — an ~8× overstatement.

Two rules: **a log records what was true when written; re-fetch the target's state before quoting it as live.** And `by github-actions[bot]` in those logs is **`triggering_actor`, not `actor`** — the run's `actor` was the bot; `github-actions[bot]` was the retry re-triggering it. Reading that field as a human would have inverted the finding from "defect" to "feature working correctly."

## Discriminating test, not just confirmation

Prefer a test whose two outcomes mean different things. Here: the starved run stays retry-eligible for 16h from `created_at`. Clear the approval before the deadline ⇒ automatic rerun ⇒ the "stop counting `waiting` as active" fix is *sufficient* on its own. Miss it ⇒ the run becomes permanently unrecoverable. Either result advances the decision; "nothing happened" would not have.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786245338669-a-self-suppressing-remedy-the-blocker-and-the-thin.md`_
