---
title: "[approver/infra-abstain] a slow build+probe on a BLOCK-vs-not pivot can outrun the session and the merge — bound it or record ABSTAIN promptly"
type: learning
topic: review-approval
source: learnings/1784055090518-approver-infra-abstain-a-slow-build-probe-on-a-blo.md
---

# [approver/infra-abstain] a slow build+probe on a BLOCK-vs-not pivot can outrun the session and the merge — bound it or record ABSTAIN promptly

**Symptom:** slang#12031 R4 hinged on a genuine BLOCK-vs-not-a-bug pivot: was differentiating a read-through-ref-accessor (a) a silent wrong gradient [→BLOCK] or (c) a clean front-end/pre-existing rejection [→not-a-bug]? The reviewer's code trace couldn't rule out (c) statically. Correctly (per "any doubt ⇒ ABSTAIN", "never round"), I steered the reviewer to build the PR head + run a 3-line runtime probe for a definitive answer, and did NOT record a hedged decision. But the build was slow (~15-20 min), the session went dormant with it running, and the PR MERGED ~4 days later — a merge webhook woke the session. The probe result never arrived, so R4 sat UNRECORDED across the dormancy.

**Root cause:** a decision-critical async step (build+probe) whose latency exceeded the session's active lifetime, with no mechanism to (a) keep the session alive until it returned or (b) force a terminal decision at dormancy. Holding for the definitive answer was the right *judgment*, but leaving the pivot decision unrecorded was a process gap: the ledger had no R4 row when the merge landed, so the human-verdict join (`record_human_verdict`) had nothing to stamp onto until I recorded the row post-hoc.

**How to catch it:** whenever the decision blocks on an async result (build, probe, long reviewer turn) that could outlast the turn, decide up front: is the result obtainable within the session? If not, the honest immediate state is ABSTAIN_INFRA / CHALLENGER_INCOMPLETE — record THAT now, then upgrade/supersede if the result arrives. Don't leave a pivot decision unrecorded pending a slow external step.

**Fix:** (1) For a BLOCK-vs-not pivot needing a build, either bound the build to complete in-session (foreground/monitor) before ending the turn, or record ABSTAIN_INFRA:CHALLENGER_INCOMPLETE immediately and treat the probe as a later supersede. (2) On a `pr_merged`/`pr_closed` webhook that wakes a dormant decision, first check whether a ledger row exists for the pinned commit; if not, complete + record the (honest, possibly ABSTAIN) decision BEFORE calling record_human_verdict, since the join keys on (repo, pr, commit_sha) and no-ops without a row. (3) Never let the merge outcome round the decision — merged is the human join, not your verdict.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784055090518-approver-infra-abstain-a-slow-build-probe-on-a-blo.md`_
