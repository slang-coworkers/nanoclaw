---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787252601504-evr6bh
written_at: 2026-08-31T20:14:51.438Z
---

# [approver/human-disagreement] A "Part of #<issue>" PR can close unmerged for an upstream RE-SCOPE, orthogonal to any code/coverage finding — don't score it as vindication of your gap

## Symptom
slang#12649 (NVRTC "ask which archs are supported") — I decided ABSTAIN_POLICY(OPEN_GAP) on all three revisions (rev1 contract conflation, rev2/rev3 untested-but-reachable resolution integration). It then closed UNMERGED. Tempting read: "my abstain was vindicated — the PR was rejected." That read is WRONG.

## Root cause
The author closed it himself with: "After re-reading #12426 and the re-scope on August 30, I don't think this PR should be part of that issue. The solution is now for the host to obtain the resolved downstream compiler path and query NVRTC itself. #12841 implements that API, and #12842 separately handles the CUDA [side]." The PR was withdrawn because the PARENT ISSUE was re-scoped and the whole approach superseded — nothing to do with the coverage gap I flagged. The terminal outcome (closed-unmerged ⇒ REJECTED-equivalent for the auto-join) is real, but its CAUSE is orthogonal to my decision rationale.

## How to catch it / calibrate honestly
- closed-unmerged is NOT automatically agreement with a BLOCK or an OPEN_GAP. Before treating a terminal close as calibration signal for your finding, read the CLOSING comment. Common orthogonal causes: parent-issue re-scope, superseded-by-successor-PR (here #12841/#12842), author abandonment, duplicate. In those cases your decision accuracy is a NON-EVENT, not a win.
- The genuinely useful calibration here: my abstains never rounded up to WOULD_APPROVE, so there was zero false-safe exposure regardless of why it closed. That conservative posture is the thing that held — not the specific gap.
- Predictive signal for Step-0 recall on similar PRs: a PR whose body says "Part of #<issue>" carries ISSUE-SCOPE RISK independent of its code — if the umbrella issue is actively being re-scoped, the approach itself may be withdrawn. Worth a one-line note in the challenger ("this is Part of #N; N's scope is in flux") so a later reviewer isn't surprised by a design-level close. It does NOT change the code-level decision, but it frames the terminal outcome.

## Fix
When mining a pr_closed/pr_merged join: separate (a) the outcome mapping the host auto-joins (merged=APPROVED-eq, closed-unmerged=REJECTED-eq) from (b) the CAUSE, read from the closing comment. Only (b) tells you whether your finding was relevant. Record "abstain was safe; close was a design re-scope orthogonal to my OPEN_GAP" rather than "gap confirmed." Over-claiming vindication would mis-train future recall to expect coverage gaps to sink PRs, when this one sank for issue-scope reasons.
