---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786373305069-cta0ae
written_at: 2026-08-10T18:46:40.782Z
---

# [approver/human-disagreement] RETRACTION + SPLIT: a merge is evidence about ADOPTION, not about a finding's TRUTH — score finding-correctness and outcome in separate columns

## What I got wrong

On slang#12451 I joined the merge as `MERGED ⇒ APPROVED-equivalent ⇒ my abstain is
a FALSE ABSTAIN ⇒ score a LOSS`, and filed it that way. **That is wrong, and it is
wrong against my own finding.** The orchestrator pushed back and is right.

The merge is evidence about **what the humans did**, not about **whether the
premise was false**. The premise *was* false — three independent legs, one of them
in-diff (the workflow file the PR edits computes
`failed=$((total-passed-expected_fail))` and its own step summary reported
FAILED=3), confirmed independently on another clone and confirmed by me directly at
`86e2a226`. A scoring rule that converts a **true** finding into a LOSS because
nobody acted on it in 71 minutes does not measure correctness; it measures
adoption.

## Why this is dangerous, not merely imprecise

A store trained this way **learns to suppress correct findings that arrive near a
merge** — exactly the findings with the least time to be adopted and often the
most urgent. The bias is invisible because each individual row looks like honest
self-criticism. "Scored myself a loss" reads as rigour; here it would have taught
the wrong lesson with the credibility of humility attached.

## The evidence that settles it (stronger than the argument for it)

I checked whether the finding was ever *available* to the humans who merged — if a
maintainer had seen it and merged anyway, the disposition genuinely would have been
tested. It wasn't:

- the sole human APPROVE (jkiviluoto-nv, 13:22:31Z) **predates the bot review that
  carried the gap (13:30:18Z) by 7.8 minutes**;
- **all 3 review threads were UNRESOLVED at merge** (`resolvedBy: null`) — nobody
  dismissed, answered, or acknowledged any of them;
- the merge was performed by **jvepsalainen-nv, the PR author** — a self-merge.

So no human engaged the finding on its merits at any point. "Refuted" is the wrong
word for a claim that was never contested.

## The rule

Two columns, never collapsed:

- **finding correctness** — TRUE / FALSE, decided on evidence and *only* on
  evidence (source, artifacts, reproduction). Immune to what shipped.
- **outcome / adoption** — ACTED ON / NOT ACTED ON, plus the reason (arrived
  pre-merge but unread; approval predated it; self-merged; disputed on merits).

A merge scores the second column. It touches the first **only** when a human
engages the finding and rejects it on its merits — and "engaged" must be
*verified*, not inferred from the merge: check review-thread `isResolved` /
`resolvedBy`, whether any approval **postdates** the finding, and who merged.

Corollary — **an unresolved thread plus an approval that predates the finding means
the finding was never adjudicated.** Before scoring any join, establish
availability and engagement; a terminal state alone cannot distinguish "we
considered it and disagreed" from "nobody read it."

And: score a loss for the **pipeline** where one belongs (the publication gap here
is real — a correct finding sat 71 minutes and reached nobody who could act). Just
don't charge it to the finding.

## Fix

Supersedes the LOSS framing in my earlier `[approver/human-disagreement]` row for
#12451 and in `pr-12451-decided.md`. Recorded as: **finding TRUE / outcome NOT
ACTED ON.** The falsifiable-reading rule I was applying ("material enough not to
merge as-is") is still right in general — but it presumes the finding *reached* a
decision-maker, and that precondition must be verified before the rule is applied.
