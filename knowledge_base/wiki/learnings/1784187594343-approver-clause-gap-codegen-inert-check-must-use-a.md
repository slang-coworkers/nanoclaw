---
title: "[approver/clause-gap] Codegen-inert check must use a TRUE two-dot content diff — a rebase makes gh-compare mask real codegen changes"
type: learning
topic: review-approval
source: learnings/1784187594343-approver-clause-gap-codegen-inert-check-must-use-a.md
---

# [approver/clause-gap] Codegen-inert check must use a TRUE two-dot content diff — a rebase makes gh-compare mask real codegen changes

**Symptom.** On a long-lived PR with a standing "let codegen-inert synchronizes ride the recorded decision" rule (shader-slang/slang#12080), a new synchronize looked like more of the same doc/test polish. The author had **rebased/squashed** the PR to a single commit. My scripted codegen-inert check diffed the recorded head → new head with `gh api compare/<recorded>...<head>` (three-dot). Because the rebase moved the merge-base, the compare was contaminated — the whole feature showed as "ADD" and my comment-stripping filter's ADD/DEL list did not cleanly isolate the real change. A genuine emit/IR-lowering change (`emitGetAddress(getPtrType(arg->getFullType()),arg)` → `getPtrType(arg->getDataType())`) was nearly masked as "just more inert polish."

**Root cause.** `gh api compare/A...B` is a **three-dot** (merge-base-relative) diff. When B has been rebased so A is no longer B's ancestor (`ahead=N/behind=M`, `status=diverged`), the merge-base is not A, so the compare shows `base(A,B)→B`, not `A→B`. For a codegen-inert check whose whole job is "did the emit/lowering change between the recorded tree and this tree," a merge-base-relative diff is the WRONG diff and can both over-report (whole feature as new) and obscure the one line that actually changed.

**How to catch it.** (1) Always check `ahead/behind/status` first — if `behind>0` or `status=diverged`, the PR was rebased and `gh compare` is unreliable for an A→B interdiff. (2) Do a **true two-dot content diff**: fetch the file CONTENT at both commits (`gh api contents/<path>?ref=<sha> --jq .content | base64 -d`) for the emit/lowering/predicate/gating files, write to temp, and `diff -u` directly. That compares the actual trees regardless of merge-base. (3) Read the resulting diff line-by-line — do not trust a comment-stripping awk filter alone, especially when a file shows deletions (comment reflows produce deletions too, so deletions ≠ code change, but they demand eyeballing).

**Why it matters (guardrail).** The standing rule lets codegen-inert synchronizes ride an existing recorded decision without a re-gate. The inert check is load-bearing: if it wrongly certifies a real lowering change as inert, a codegen change ships under a stale approval — exactly the false-safe class. Here the true two-dot diff is what made the guardrail actually fire; the contaminated `gh compare` would have let it skate.

**Fix.** In the codegen-inert check: branch on rebase. If `status=diverged`/`behind>0`, use the true two-dot content diff of the emit/lowering files (fetch-content + local `diff`), never the three-dot `gh compare`. Read the source diff by hand and verify emitted BEHAVIOR, not the commit label. Relates to [[pr-12080-decided]] and the standing codegen-inert rule [approver/clause-gap] standing-decision-rides-codegen-inert. (In this instance the change was verified correct-by-construction — getDataType() matches the callee getBorrowInParamType(param->getDataType()) slot — so it was WOULD_APPROVE, but the point is the check must be able to SEE it to decide.)

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784187594343-approver-clause-gap-codegen-inert-check-must-use-a.md`_
