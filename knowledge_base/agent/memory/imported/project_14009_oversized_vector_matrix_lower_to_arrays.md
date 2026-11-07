---
type: project
name: project_14009_oversized_vector_matrix_lower_to_arrays
description: "HELD, no bot action. slang#14009 (albertrodriguezclo, CONTRIBUTOR): accept vector<T,N>/matrix<T,R,C> with N,R,C > 4, lowered to arrays; author's PR #14012 open, not rebased pending direction. 11-06 19:01Z the assignee jkwak-work: Slang prefers to support it, low priority, approach to be aligned with Yong (label Office-Yong). No @-mention: no dispatch, no post, no timer."
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

**11-02 12:00Z re-check (`i14009-recheck-f04a`) — stays held on the author's PR.** The author opened
**PR #14012** "Support vectors and matrices larger than 4 (up to 16) by lowering them to arrays" at 10-29 12:14:26Z,
36 min after my watch ended. It is OPEN, not a draft, with no review decision and merge state BEHIND (last
updated 11-01 06:17Z). Its reviews are coderabbitai plus the author's replies; no maintainer review yet. The
issue is still open with 0 comments and no labels; github-actions assigned `jkwak-work` (10-29 12:14:48Z). There
is no maintainer comment and no @nv-slang-bot mention. The other timeline rows are bot cross-references from
#14020 (the author's linear-algebra proposal) and #14109 (bot-filed, "Constrain the element type of
`vector` and `matrix`"). There is no Main dispatch. A webhook on #14012 resumes the chain.

**11-02 17:53:36Z maintainer comment (`pr_mention`, issuecomment-6584275363).** jkwak-work (MEMBER, the
assignee) wrote: "I don't think we want to support this behavior at the moment. But I will bring this to a
discussion later in a meeting." The live body matches the payload and was not edited. It @-mentions nobody, so
it is not a summons (rule 5): no dispatch, no reaction, no bot post. The issue now has the label `Office-Tess`.
PR #14012 is still open, not a draft, no review decision; no pr-mappings row, so no coworker owns it. The bot
has no pending action, so there is **no timer**. The decision belongs to the maintainers' meeting.
**Resume on:** an @nv-slang-bot mention on #14009/#14012, a maintainer decision posted on either, or an
operator ask.

**11-03 18:00Z author reply (issuecomment-6611591941).** The author keeps #14012 open as a working
implementation for the meeting but will not rebase it until there is a direction. They offer to join the meeting
or write up the use case.

**11-06 19:01:05Z maintainer comment (`pr_mention`, issuecomment-6692985740).** jkwak-work (MEMBER, the assignee)
wrote: "We discussed this and it sounds like Slang prefers to support this feature although the priority is low at
the moment. I will discuss with Yong how to approach this later to be more aligned." The live body matches the payload.
The label changed from `Office-Tess` to `Office-Yong`. It @-mentions nobody, so it is not a summons: no dispatch, no
post, no timer. The direction (how to approach it) is still open between jkwak-work and Yong. PR #14012 is still
open, not a draft, only a coderabbitai review, and no pr-mappings row.
**Resume on:** an approach posted on #14009/#14012, an @nv-slang-bot mention, or an operator ask.

Same-author siblings: [#13949](project_13949_peephole_param_self_arg_hang.md),
[#13960](project_13960_single_call_site_inlining_hlsl_wgsl.md).
