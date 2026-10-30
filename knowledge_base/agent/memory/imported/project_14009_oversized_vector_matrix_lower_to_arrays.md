---
type: project
name: project_14009_oversized_vector_matrix_lower_to_arrays
description: "HELD 10-29 11:38Z, no dispatch, no bot post. slang#14009 (albertrodriguezclo, CONTRIBUTOR): feature request to accept vector<T,N>/matrix<T,R,C> with N,R,C > 4 (e.g. 12x12 for IPC contact Hessians) and lower the oversized ones to arrays on targets whose native types stop at 4. Author wrote \"I'm working on a PR\"; none appeared in a 10-min watch. One-shot re-check i14009-recheck-f04a at 11-02T12:00Z."
---

# slang#14009: vector and matrix sizes larger than 4, lowered to arrays

**10-29 11:25:38Z `issue_opened`.** Main webhook session `sess-1793273143444-z4h3nt` (the only session on
`gh-issue-shader-slang/slang-14009`). Live read at 11:27Z: open, 0 comments, no labels, no assignee, no
issue type, body not edited.

**Request:** `matrix<float,12,12>` gives E38206 "invalid vector element count" on spirv/metal/cuda. Proposal:
accept sizes > 4 up to some bound (16 or 32), lower oversized ones to arrays (matrix → array of row arrays)
before emission, and keep ≤ 4 native. In scope: construction, element/row access, `mul`, `transpose`, `dot`,
component-wise ops, `select`, element-wise intrinsics. Out of scope (still errors): swizzles, varyings/vertex
input, texture formats; `determinant`/`inverse` stay ≤ 4. Open design points: upper bound; buffer layout as
array layout per std430/scalar/natural; reflection reports array or real-size matrix ("to be decided");
autodiff must survive the lowering. Related: #12420 (E38206), #10298 (neural module).

**Ownership:** the body says "I'm working on a PR". This author files an issue and then their own PR
(#13949→#13950 in 5 min; #13960→#13962 in 2 h; #13998→#13999 in 25 s). A 10-min watch (11:28–11:38Z) of the
timeline and the author's PRs found nothing. So the hold follows rule 4 of
[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new](feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new.md):
a claimed reporter fix is the reporter's work item. A fixer dispatch would compete with it, and a triage post
would be a bot post on a human issue (R6). Design calls (bound, reflection shape) belong to maintainers on the PR.

**Timer:** one-shot `i14009-recheck-f04a`, 2026-11-02T12:00Z. It reads live state and reports to
orchestrator-dashboard only (never GitHub).
**Resume on:** the author's PR (the PR review flow owns it), a maintainer comment, an @nv-slang-bot mention,
or an operator ask (for example, "internal-only triage").

Same-author siblings: [#13949](project_13949_peephole_param_self_arg_hang.md),
[#13960](project_13960_single_call_site_inlining_hlsl_wgsl.md).
