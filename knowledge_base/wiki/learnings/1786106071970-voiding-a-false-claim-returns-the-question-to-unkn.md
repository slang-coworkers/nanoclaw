---
title: "Voiding a false claim returns the question to UNKNOWN, not to the opposite claim — and a baseline needs a DATE range-check"
type: learning
topic: verification
source: learnings/1786106071970-voiding-a-false-claim-returns-the-question-to-unkn.md
---

# Voiding a false claim returns the question to UNKNOWN, not to the opposite claim — and a baseline needs a DATE range-check

I asserted "`test-falcor` is infra-red on master too" to argue a PR's CI failure wasn't mine. Then I retracted it. **Both the claim and the retraction were one axis wider than the evidence.**

**The sequence.** (1) Claimed falcor red on master — unsupported. (2) Retracted after finding falcor was `success` on the two most recent master `ci.yml` runs. (3) A reviewer pointed out those runs are **2026-06-23 and 2026-06-17** — ~6.5 weeks old at the time. I verified independently and it's worse than stale: every recent master `ci.yml` run is `workflow_dispatch` (manual), and the last `pull_request`-event master run is **2026-04-01**. Master gets no routine `ci.yml` runs at all.

**So there is no recent master baseline in either direction.** The correct end state is **UNKNOWN**, plus *why* it's unknowable. My retraction had quietly installed "falcor is green on master" as the new fact — which is a different unsupported claim, not a return to neutral.

**Rules:**

1. **A retraction is not a polarity flip.** Withdrawing "X is red" yields "X's status is unmeasured," not "X is green." Write the null explicitly. Over-retraction reads as rigour and costs exactly as much as over-claim — it manufactures a fact in the opposite direction while feeling like humility.

2. **Range-check the DATE of any run you cite as a baseline.** A run id resolves and returns a clean `conclusion` whether it is 2 hours or 4 months old — there is no staleness warning in the payload. Before "it passes on master," check `createdAt` *and* `event`: a `workflow_dispatch`-only history means nobody is routinely measuring that branch, so absence of recent red is not evidence of green.

3. **Name the population, not just the verdict.** "Green on master" implicitly claims "on current master." If the newest qualifying run predates the code under discussion, the honest statement is "no baseline since <date>."

Same fact got mis-stated **three times** on one chain (red → green → unknown), which is the tell that the defect was in publish-time reading discipline, not in measurement — the underlying queries were fine every time. Before publishing any status claim, write out "this rules out ___ / this does NOT rule out ___". A stale-baseline query rules out *nothing* about today.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1786106071970-voiding-a-false-claim-returns-the-question-to-unkn.md`_
