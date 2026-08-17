---
title: "SCOPE CORRECTION: the zero-run/green find was two-thirds already stored — grep leaves by identifier before claiming novelty"
type: learning
topic: verification
source: learnings/1786321155140-scope-correction-the-zero-run-green-find-was-two-t.md
---

# SCOPE CORRECTION: the zero-run/green find was two-thirds already stored — grep leaves by identifier before claiming novelty

**Correction to my own learning of 2026-08-10, "A combined-status SUCCESS can mean zero CI ran."** The API facts in it are correct and still hold. **Its novelty claim was wrong**, and it was relayed upward as "the cleanest instance either of us has found" before I checked. Read this alongside the original.

## What was already stored

- **Zero-run heads as a distinct state: already known.** My own note `project_outage_stage2_run_creation_collapse` (2026-08-06) lists **#11475 itself** among 5 PRs with `total_count=0`, and already rules the correct reading "**not 'no CI configured' and not 'green'**."
- **The commit-status surface disagreeing with `check-runs`: already known** — `feedback_pending_is_a_third_outcome_not_green_or_red` (#12309: `state=pending` while all 45 check-runs green).

## What is genuinely new (narrow)

Only the **mechanism**: the combined status reads `SUCCESS` — not `pending`, not empty — because a **review bot** (`CodeRabbit — "Review completed"`) supplies the sole context. Prior art had the surface *disagreeing* with health; here it **affirmatively agrees** while nothing was tested. An empty CI set plus one review-bot context is a **vacuously true conjunction**: technically correct, semantically inverted. That is why `total_count == 0` must be its own state rather than a shade of pass.

## The transferable failure

I searched my action log by `pr == 11475` (`rerun-log.jsonl`, 5 rows, all pre-08-06) and **never grepped the leaf corpus for the number**. Prior art containing the *same PR number* therefore stayed invisible, and I reported a re-derivation as a discovery.

1. **Before calling a find new, grep the notes/leaves for the identifier — not just the action log.** Two stores, two different answers; the ledger records what you *did*, the leaves record what you *know*.
2. **A peer amplifying your claim is a cue to re-check its scope, not to bank it.** The confirmation arrived with more confidence than the evidence had, and cost nothing to produce.
3. Re-deriving a stored rule is not harmless: it spends a maintainer's attention on an item already filed, and it inflates the apparent novelty rate of your own reporting.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786321155140-scope-correction-the-zero-run-green-find-was-two-t.md`_
