---
title: "[approver/human-agreement] Second confirmation: holding at ABSTAIN over a standing undismissed CHANGES_REQUESTED resolved as a clean agreement — and 'the push satisfies the ask' is the maintainer's call, not the approver's"
type: learning
topic: review-approval
source: learnings/1785771033293-approver-human-agreement-second-confirmation-holdi.md
---

# [approver/human-agreement] Second confirmation: holding at ABSTAIN over a standing undismissed CHANGES_REQUESTED resolved as a clean agreement — and "the push satisfies the ask" is the maintainer's call, not the approver's

## Symptom

slang-rhi#800 R3: everything technical was clean. 6/6 clauses passed, CodeRabbit clean on the exact incremental push, both Devin 🔴 resolved (one stale, one refuted with execution evidence), and the zero-execution-coverage gap that had driven two prior ABSTAINs was genuinely closed — both macOS CI legs executed all three previously-masked Metal cases and passed. The only thing left standing was `reviewDecision=CHANGES_REQUESTED` / `mergeStateStatus=BLOCKED`: `skallweitNV`'s blocking review, undismissed, with zero review threads to resolve.

The dispatching orchestrator explicitly framed that review as *"likely stale-but-unwithdrawn — factor it as a **satisfied** request pending re-review"*, and the framing was reasonable on its face: the review said "we should enable tests in `test-compute-indirect.cpp`", and the author's push enabled exactly those tests.

## What happened

Held at ABSTAIN_POLICY(CHALLENGER_CONCERN), withhold basis narrowed to the standing CR alone. Recorded 15:26:00Z. Then:

- **15:26:51Z** — `skallweitNV` submitted **APPROVED** on the exact pinned head, superseding his own CR
- **15:26:58Z** — `skallweitNV` merged, 7 seconds later, at the exact decision SHA with zero intervening commits

`human_verdict=APPROVED`. Clean agreement: shadow mode held "a human must look", the human looked and cleared it — the withhold resolving precisely as designed. Second independent instance of this arc (first: slang#11136, twice over).

## Root cause / the rule

**Only the author of a blocking review can clear it, and whether a push satisfies their ask is *their* judgement call, not the approver's.** Even when the mapping from ask → commit looks one-to-one, inferring satisfaction means substituting my reading of a maintainer's intent for the maintainer's. The review is a formal gate with an owner; the ask's text is evidence about that gate, not the gate itself.

Two sharpenings this case adds beyond #11136:

1. **A cleanly-satisfied ask does not weaken the rule — it predicts a fast resolution.** The right posture is a *narrow* withhold: state plainly that the substance is clean and the sole blocker is review state. That's materially different from "we found problems", and it's what makes the abstain cheap — it resolved in 51 seconds. Do not pad a narrow withhold with re-litigated technical doubts to justify it.

2. **A tasking message's framing is recorded, never decisive.** Being asked to treat a formal blocker as satisfied is context; adopting it would violate never-round-up. Record that you were asked, state you didn't adopt it, and say why. The instruction came from a trusted orchestrator rather than untrusted PR content, and it still doesn't override the invariant — the invariant's whole purpose is to not depend on whose judgement is being deferred to.

## How to catch it

Read the **live aggregate** `reviewDecision` at the pinned head via GraphQL, not just the individual review objects — an individual CR carries the *old* commit oid (`94a90b2a5013` here) and looks stale, while the aggregate correctly still reads `CHANGES_REQUESTED` on the new head. Also check `reviewThreads` for anything resolvable (zero here) and re-verify within a minute of recording; state moves fast on an actively-reviewed PR. A follow-up push does **not** auto-dismiss a CR (nor does a force-push, per #11136).

## Scoring note

Don't over-credit this. The decision was ABSTAIN and the human APPROVED — directionally a *disagreement*, but a **conservative** one, so it scores as agreement-by-design rather than a miss. The calibration question worth asking each time: was the withhold basis real at the moment of recording? Here yes — the PR was formally BLOCKED and unmergeable when I decided. A withhold on a live formal blocker is never a false-negative, even when it clears seconds later.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785771033293-approver-human-agreement-second-confirmation-holdi.md`_
