---
title: "[approver/human-disagreement] fork codegen PR with unrun validating test — ABSTAIN(OPEN_GAP) vs human APPROVE is directionally-correct, not a miss"
type: learning
topic: review-approval
source: learnings/1785353094549-approver-human-disagreement-fork-codegen-pr-with-u.md
---

# [approver/human-disagreement] fork codegen PR with unrun validating test — ABSTAIN(OPEN_GAP) vs human APPROVE is directionally-correct, not a miss

# [approver/human-disagreement] Fork Metal-codegen PR, validating test never ran: my ABSTAIN(OPEN_GAP) vs human APPROVED

**PR:** shader-slang/slang#12142 "[Metal] Fix RayQuery TriangleFrontFace emission", ramang-unity (fork, CONTRIBUTOR), head `2a61c227a2ca`.
**My shadow call:** ABSTAIN_POLICY (OPEN_GAP) @ 2026-07-19.
**Human verdict:** kaizhangNV (Metal domain maintainer) **APPROVED** 2026-07-29 ("LGTM, thanks for contributing"), review 4812124952, @ the **exact same commit** `2a61c227a2ca` I decided on. PR still open at join time (not yet merged).

## Symptom
A source-verified-correct Metal codegen fix. I ABSTAINed solely because the validating `-target metal` FileCheck test **never executed** — fork PR, `CI` build/test matrix stuck at `action_required`/0 jobs (maintainer-gated, never approved to run); the green combined status was false-green (only license/cla + CodeRabbit + SlangPy-trigger). A domain maintainer approved on inspection.

## Root cause of the disagreement (why it is NOT a miss)
- This is the **conservative** direction of disagreement (ABSTAIN vs APPROVE), the OPPOSITE of a false-safe (WOULD_APPROVE vs CHANGES_REQUESTED). The abstain did exactly its designed job: "correct-by-inspection but unvalidated codegen → route to a human." A human looked and confirmed the code. That IS the intended resolution path, not a failure of it.
- The evidence I gathered was fully corroborated by the maintainer's approval: the fix aligns table-generated MSL accessors with pre-existing hand-written `is_*_triangle_front_facing` at hlsl.meta.slang:21842/21863; byte-identical MSL for every non-front-face accessor; nil blast radius. kaizhangNV (the requested reviewer, Metal expert) cleared it with "LGTM" — an expert inspection reaching the same conclusion my challenger did.

## How to catch it / calibration takeaway
- **Do NOT round this class up to WOULD_APPROVE going forward.** The lesson is not "I was too conservative." Shadow mode never rounds up on an unexecuted codegen change; an ABSTAIN that a domain maintainer later clears by inspection is a *correct* abstain with a good outcome, not an over-abstain to correct. Repeated identically for siblings #12138, #800 slang-rhi, #801 slang-rhi, #12142 — consistent, defensible policy.
- **What WOULD change the call:** the only thing that closes the OPEN_GAP is the validating test actually running (maintainer approves fork CI, or the equivalent leg runs post-merge). Expert human approval on inspection resolves the PR but does not retroactively make my "test unrun" fact false — so my decision-time reason_code was accurate.
- **Sharper Step-0 recall for next time:** when a fork codegen PR is (a) source-verified correct, (b) corroborated by a pre-existing sibling accessor in-repo, AND (c) the requested reviewer is the domain-area maintainer, expect a human APPROVE-on-inspection to be the likely resolution. Still ABSTAIN (the test-unrun gap is real and CI-invisible), but frame the report so the human owner (maintainer CI-approval) is named crisply — which shortens the human loop.

## Meta
Fully handled through the read-only gh-shim during the standing GH_TOKEN/OneCLI outage (day 4 on 07-19) — never an infra abstain; review signal fully obtainable on this public repo.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785353094549-approver-human-disagreement-fork-codegen-pr-with-u.md`_
