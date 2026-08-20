---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787142345605-8910d3
written_at: 2026-08-19T16:29:00.615Z
---

# [approver/human-disagreement] Resolve introduced-vs-pre-existing by diffing the BASE; a pre-existing gap the PR doesn't worsen is advisory, not OPEN_GAP

**Symptom (slang#12614 @c1f1924d2704):** I ABSTAINed (OPEN_GAP) on a Falcor CI PR because `ci-falcor-test.yml`'s sibling job `test-falcor-perf` (untouched by the diff) still downloads the EAGER `slang-tests-windows-x86_64-cl-release` artifact and, after the PR rewired the caller's `needs` to the approval-gated build, runs post-approval — seemingly re-exposing it to the 410-expiry the PR fixes for `test-falcor`. A human (`jvepsalainen-nv`) APPROVED at my exact commit and it MERGED as-is, no follow-up commits. My abstain was overruled.

**Root cause of MY miss:** My own investigation named the deciding uncertainty — "does the PR INTRODUCE the perf delay or merely LEAVE it pre-existing?" — and I abstained on that uncertainty INSTEAD OF RESOLVING IT. Resolving it took one read of the BASE file: base `ci-falcor-test.yml` had `environment: falcor-ci` directly on the inner `test-falcor` job, which (by the same reusable-workflow-gates-the-whole-invocation semantics I'd already confirmed) ALREADY made `test-falcor-perf` run post-approval on the eager artifact. So the perf 410-exposure was PRE-EXISTING and unchanged; the PR is a strict improvement to `test-falcor` and does not regress perf (the extra rebuild wait is negligible vs the dominant approval-queue delay present in both versions).

**The class / how to catch it:** When a challenger gap hinges on "introduced vs pre-existing," that is NOT a reason to abstain — it is a cheap, decidable question: read the file at the PR base (`gh api .../contents/<path>?ref=<baseRefOid>` or `gh pr diff` context) and compare. A condition present in the base that the PR neither introduces nor materially worsens is ADVISORY (clears), because the gap is not a property of THIS change — abstaining on it penalizes a PR for improving one sibling while leaving another exactly as it was. Only introduced/worsened conditions, or gaps in code the PR actually touches, warrant OPEN_GAP. "Uncertainty ⇒ ABSTAIN" applies to uncertainty you CANNOT cheaply resolve — not to a base-diff you simply didn't run.

**Fix for next time:** Before recording OPEN_GAP on a sibling/adjacent-code concern, run the base-vs-head diff on the specific file/behavior and state the delta explicitly. If the answer is "pre-existing, unchanged," clear it as advisory and proceed to the normal WOULD_APPROVE/critique path. Note: the underlying observation (perf sits on the eager artifact) is still a legitimate advisory note a maintainer may want to follow up — advisory ≠ wrong, it just doesn't block/abstain this PR.
