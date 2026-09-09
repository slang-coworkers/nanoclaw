---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786383081044-aco4mj
written_at: 2026-08-10T18:19:30.118Z
---

# [approver/infra-abstain] A Devin timeout is a fact about my patience — ONE bounded retry flipped a NO_REVIEW_SIGNAL abstain into a BLOCK with a verified finding

## Symptom

On slang-rhi#826 the first `devin-fetch.sh` run returned **exit 3 (timeout)**. With
no `github-actions[bot]` pipeline in slang-rhi and no CodeRabbit *review object*
(harvest exit 20), that made `reviewers_complete=false` and I derived
**ABSTAIN_INFRA:NO_REVIEW_SIGNAL** — "the pipeline produced no review."

That decision was wrong. One bounded retry of the identical command returned
**exit 0** with a live review carrying `0 Bugs / 1 Flag` and four named findings
with file:line anchors. The correct decision was **BLOCK**.

## Root cause

A timeout is a statement about *my waiting window*, not about whether the artifact
exists. `NO_REVIEW_SIGNAL` asserts something about the world ("no review was
obtainable"); a single timeout only licenses "no review was obtained within 20m."
Recording the strong claim from the weak evidence converts a transient into a
permanent verdict — and because ABSTAIN_* skips the critique gate, **nothing
downstream would have caught it.**

## How to catch it

Before recording any abstain whose reason code rests on a *transient* failure
(timeout, rate-limit, browser-launch, network), re-run the fetch **once**. Cheap,
bounded, and it is the only step that distinguishes "absent" from "slow".

Distinguish the two absence classes, because only one is retryable:
- **Structural absence** — `harvest.json {"found": false}` / exit 20 because the
  repo has no such pipeline. Retrying is pointless (confirm once, then move on).
- **Transient absence** — timeout / rate-limit / never-settled page. **Always
  retry once.**

Corollary that makes this bite: **an ABSTAIN is the one state with no second
reviewer.** WOULD_APPROVE and BLOCK are critique-gated; abstains are recorded
directly, precisely because they "assert nothing about the code." But an abstain
built on a retryable transient *does* assert something false — that a human must
look because the pipeline couldn't decide, when in fact the pipeline could. Hold
abstains to the retry bar *because* nothing else will.

## Fix

Wire the retry into the command, not the intention: on exit 2/3/4, re-dispatch the
same fetch once before the reason code is chosen. Only if the second attempt also
fails does `NO_REVIEW_SIGNAL` describe the world. Also stop treating the abstain
lane as low-stakes — skipping the critique gate raises, not lowers, the evidence
bar on the inputs.

Related: the retry rule already existed in my store from slang-rhi#820/#822 ("a
timeout is about my patience, not the world ⇒ re-harvest before recording"). It
fired here only because I greped my own rows before finalizing. A rule that lives
in memory but is not bound to the *decision point* does not fire — bind it to
"before choosing a transient-based reason code."
