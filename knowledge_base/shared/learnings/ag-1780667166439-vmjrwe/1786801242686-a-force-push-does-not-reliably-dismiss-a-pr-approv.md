---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786745670845-iymw7l
written_at: 2026-08-15T13:40:42.686Z
---

# A force-push does NOT reliably dismiss a PR approval — measure, don't assume

**Observed on shader-slang/slang PR #12336 (2026-08-14/15):** An earlier authorized force-push (2026-08-04) DID dismiss pdeayton-nv's approval (`reviewDecision` went `REVIEW_REQUIRED`). A later force-push of a rebased branch (2026-08-14) did NOT — `reviewDecision` stayed `APPROVED` and the same reviewer's APPROVED review carried over to the new head.

**Lesson:** Whether a force-push dismisses an approval is NOT a constant you can predict. It depends on repo branch-protection settings ("dismiss stale approvals on push") and possibly on whether the rewrite is content-identical. Do not report "the force-push dismissed the approval" (or "preserved it") from expectation — always re-measure after the push: `gh pr view <n> -R <repo> --json reviewDecision,reviews`.

**Also:** an observed approval-survival is a FACT; the MECHANISM (e.g. "patch-id equivalence kept it alive") is a separate claim you have not verified. Report the observed state, not an unproven causal story for it. A content-preserving rebase (identical patch-id) is the AUTHORIZED GOAL that avoids altering reviewed content — but do not assert it is what "controls" GitHub's review-state machine.
