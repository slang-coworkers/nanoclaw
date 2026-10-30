---
type: project
name: project_13858_ast_natural_layout_static_members_sizeof
description: "PARKED ON MAINTAINER 10-22 17:29Z: bot draft PR #13864 (fix/issue-13858@8a17fc92e2, pr: non-breaking, 2 files +267/-3, mapped to fixer sess-1792662002552-8wg3d2) passed peer review (R1 REQUEST_CHANGES fixed, R2 APPROVE_WITH_NITS applied) and waits for a maintainer to review it and mark it ready. slang#13858 (tdavidovicNV, MEMBER): concrete sizeof/alignof counted static struct members (ASTNaturalLayoutContext::_calcSizeImpl getFields() loop, now MemberFilterStyle::Instance). Reporter declined to open a PR. OPERATOR DECISION PENDING on 4 follow-ups (bool 1-vs-4 front-end/IR mismatch + 3 getFields() static-as-instance checker sites). 10-29 re-check: still draft, no human review; jkwak-work assigned kaizhangNV + label RTR on 10-23; follow-up choice re-asked; no timer left."
metadata:
  node_type: memory
  type: project
---
**2026-10-22 08:54Z, `issue_opened`.** Live read at routing time: OPEN, 0 comments, no labels, no
assignees, created == updated, empty timeline, body = payload. Author tdavidovicNV (MEMBER), not
self-assigned, no maintainer-owned plan or PR, so rung 4 of
[[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]] does not hold it. It is a bug report
with a proposed fix. The only session on `gh-issue-shader-slang/slang-13858` is this Main webhook session
(`rnc00v`); no task; no duplicate issue or open PR found by search. Same author as
[[project_13276_rt_payload_extern_assoc_type_layout]], which was routed to the triager the same way.

**What it reports.** `struct Example { static const uint VERSION = 2; float data[2]; }` gives concrete
`sizeof == 12` but `generic_size<Example>() == 8`, so `static_assert(sizeof(Example) == 8)` fails with E41400.
A static `uint64_t` also makes concrete `alignof` 8. The folding paths are `visitSizeOfLikeExpr`
(`slang-lower-to-ir.cpp`) and `SizeOfIntVal::tryFoldOrNull`. Struct lowering and reflection already skip
statics. Main checked at master `0bd71cd709`: the field loop at `slang-ast-natural-layout.cpp:278` has no
static filter.

**R6 (#13596):** gate PR slang-coworkers/nanoclaw#1993 is still a draft, so routing is unchanged (no
hand-applied 4-day defer).

**10-22 09:03Z, triager interim (not yet a memo):** reproduced at ToT `0bd71cd709` (concrete 12, generic 8); base-struct, generic-struct and nested cases leak the same way. Validating the reporter's patch in a scratch worktree. Nothing posted yet.

**10-22 09:27Z, TRIAGED** (slang-triager; Main checked live: comment
[6337427524](https://github.com/shader-slang/slang/issues/13858#issuecomment-6337427524) posted, label `reproduced`,
type Bug, no assignee, no PR). Memo archived at `/workspace/agent/reports/triage/triage-13858.md`.
- Reproduced at `0bd71cd709`. Not a regression: the loop has had no filter since the first `sizeof` (#2954).
- The root cause is confirmed exactly as stated. `ASTNaturalLayoutContext` is built in three places:
  `SizeOfIntVal`/`AlignOfIntVal::tryFoldOrNull` (`slang-ast-val.cpp:2587/2637`) and `visitSizeOfLikeExpr`
  (`slang-lower-to-ir.cpp:5463`). The IR paths (`kIROp_SizeOf`, `__naturalStrideOf`, Std430/C) are already correct.
- One extra leak: `Derived : Base` with a static in `Base` gives 16 instead of 8. It goes through the same loop,
  so the patch covers it.
- Patch validated: every matrix case passes, and the slang-test subset passed 1026/1026 (vk/cuda/llvm/cpu). The
  full suite was still running when it reported; the triager will edit its comment with the result. Triager
  worktree: `wt-13858`, uncommitted.
- Preferred form (Approach B): `getFields(astBuilder, structDeclRef, MemberFilterStyle::Instance)`
  (`slang-syntax.h:383`), the filter reflection already uses.
- The comment asks the reporter whether they will open the PR and promises no bot PR.

**Decision (Main, 10-22):** WAIT for the reporter, timeboxed. They wrote and tested the patch; a bot PR would
duplicate their work. One-shot task `rechase-13858-reporter-p-a714` runs 10-27 12:00Z. If there is no reporter reply
and no PR, it sends the fix to slang-fixer: Approach B, the memo's test, credit to the reporter.

**10-22 09:32Z, reporter comment [6337526000](https://github.com/shader-slang/slang/issues/13858#issuecomment-6337526000)**
(@-mentions nobody, so it is not a summons; nothing posted or dispatched). Their reported downstream impact: their
`MultiBuffer<T>.load` uses generic `sizeof(T)` as the byte-offset multiplier, which gives the correct 32/24 for
`PackedTriangleVertex`/`PackedLSSVertex`. Concrete `sizeof` gives 36/28 and corrupts geometry. They say it is a tested
workaround (D3D12/Vulkan/CUDA), not a fix. **It does not answer the PR question.** Task a714 now counts only replies
after 09:32Z and carries this impact into the fixer's PR motivation.

**10-22 09:37Z, triager delta.** Comment [6337614775](https://github.com/shader-slang/slang/issues/13858#issuecomment-6337614775)
explains the generic-vs-concrete mechanism, rates the bug **high** severity (wrong byte offsets with no error), and
asks the reporter again about the PR. The full suite with the patch passed 11115/11133; all 18 failures also fail
unpatched at `0bd71cd709` (functional/*, gfx-smoke, dispatcher/smoke, 3 fp8-cuda coopmat). The live memo is the
triager's `memory/issues/triage-13858.md`, because its container can't see `reports/triage/`. The archive copy
predates the severity change.

**10-22 09:38Z, reporter: "I do not plan to open PR"** ([6337632357](https://github.com/shader-slang/slang/issues/13858#issuecomment-6337632357)).
The decision table's "reporter says no" branch applies, so Main cancelled task `rechase-13858-reporter-p-a714` and
handed the fix to slang-fixer on `gh-issue-shader-slang/slang-13858`: Approach B plus the memo's test list, the
reporter's MultiBuffer impact as motivation, credit for their diagnosis and patch, and `pr: non-breaking`.

**09:40Z fixer ack:** worktree `wt-slang-13858`, branch `fix/issue-13858` from `0bd71cd709`. When the PR lands, tell the triager it can delete `wt-13858`.

**10-22 11:38Z, draft PR [#13864](https://github.com/shader-slang/slang/pull/13864)** "Exclude static members from
concrete sizeof/alignof". Main checked live: head `0118fe2194`, label `pr: non-breaking`, MERGEABLE. 2 files:
`slang-ast-natural-layout.cpp` +5/-3 (Approach B, keeps `field.getDecl()->getType()`), new
`tests/hlsl-intrinsic/size-of/size-of-static-member.slang` +223 (cpu/vk/cuda/llvm). The body credits the reporter and
says `Fixes #13858`. Fixer's full suite at head: 11134/11137, the 3 failures being pre-existing fp8-cuda. Noted risk: a
struct with only static members now has `sizeof` 0, not 4 (matches IR). CI is mostly `skipping` (draft gate).
`pr-mappings` maps it to fixer `sess-1792662002552-8wg3d2` on the canonical thread. The explanation HTML is in
`/workspace/inbox/a2a-1792669184441-0jtv11/`.

**10-22 11:46Z, fixer [Report]:** a `[Fix Review Request]` went to slang-reviewer; the `[Fix Report]` comes after the
verdict. Main checked live: explanation cmt 6339821912 on the PR, issue status cmt 6339840173 ("held for review"),
still a draft at `0118fe2194`, CI 5 pass / 52 skipping. The fixer's new test fails without the fix and passes 4/4;
the size-of dirs pass 50/50; codex approved.
**Out-of-scope follow-ups (fixer's finding):** three more `StructDecl::getFields()` loops treat statics as
instance fields: `slang-check-shader.cpp:1558` (`doStructFieldsHaveSemanticImpl`; the fixer says an entry-point
param is silently treated as uniform), `slang-check-decl.cpp:23229` (opaque-handle walk; `Optional<S>` rejected),
and `:18183` (`ref` accessor rejected). Main confirmed at master `0bd71cd709` only that the three loops have no
static filter, not the effects. **Not filed:** the operator decides whether to file follow-up issues, and the
fixer was told to hold.

**10-22 14:16Z, slang-reviewer R1 on `0118fe2194`: REQUEST_CHANGES, test-only.** A: 0 bugs / 1 gap / 1 question; B
(Devin): 0; C (clarity): 6 kept. The source fix is correct. The gap: the Std430 control is not a compile-time
`static_assert`, though the reviewer showed it can be. The `SelfStatic` case also passes unpatched, so it doesn't
test the bug. The reviewer's remedy patch passes 4/4 at head and fails 4/4 unpatched. Nothing was posted (no
authorization marker). Main checked live: no human reviews or comments on #13864 or #13858 since 09:38Z. The
reviewer's phrase "maintainer's request (R3)" names no maintainer: the requirement comes from the issue body and
the triage memo. Main told the fixer not to attribute it to a maintainer publicly. Next: the fixer applies the
patch, then review R2.
**10-22 14:47Z, R1 fixes pushed; R2 (the last round) requested.** Head is `24aca3d302` (commits `aac74dda7d` and
`24aca3d302` on top of `0118fe2194`, no force-push), still a draft. Main checked live: 2 files (+8/-3 source, +246
test), and the only "maintainer" in the PR body is the standard footer. The reviewer's test patch was applied
verbatim. The new test passes 4/4 and fails 4/4 with the fix reverted. Full suite 11134/11137 (fp8-cuda pre-existing).
CI run 39798502116.
**10-22 16:42Z, slang-reviewer R2 on `24aca3d302`: APPROVE_WITH_NITS** (A: 0 bugs / 1 gap; B: 0; C: 4). All R1
findings are fixed. New gap (A, confirmed by the reviewer): on master the front end sizes `bool` as 1 byte
(`slang-base-type-info.cpp:9`, `sizeof(bool)`), while IR natural layout sizes it as 4 (C layout sizes it as 1,
`slang-ir-layout.cpp:698`). **Main reproduced it on the local Release build:** concrete `sizeof(bool)` and
`sizeof(struct{bool})` = 1U, generic = 4U. The PR widens the exposure: a struct with an unsizable static member
(its own type, `Ptr`, `uintptr_t`, `SamplerState`) plus a `bool` field used to fall back to IR (4) and now folds to
1. The reviewer's nits: narrow the loop comment, correct the PR body's Risk line, and do not pin the wrong value in
a test. #12316 (layout-policy duplication tech debt, OPEN) covers this class but never mentions `bool`. Probe:
the reviewer's `runs/drill-13864-r2/boolreg.slang`. **Operator asked (16:4xZ)** whether to file it, folded into
the follow-up question.
**10-22 17:29Z, [Fix Report] (fixer): fixed, draft, ready for human review.** Main checked live: head `8a17fc92e2`,
5 commits, 2 files (+8/-3 source, +259 test), MERGEABLE, CI 4 pass / 52 skipping (draft gate). The Risk line now names
the static-only struct (0 bytes, align 1) and the `bool` case. The explanation comment (6339821912) and the issue status
comment (6339840173) were both edited at 17:28Z. The test passes 4/4 at head and fails 4/4 with the fix reverted; the
dx12 row is ignored on Linux. The full-suite rerun at `8a17fc9` was invalid because other sessions had saturated the
shared L40S (44.5/46 GB, load ~100); the last clean run was at `aac74dd`, and later commits change only comments and
the test. Main armed one-shot `rechase-13858-pr-13864-6a46` (10-29 12:00Z) covering the maintainer review and the
operator's follow-up choice.
**Operator decision pending (asked 11:46Z on the dashboard thread):** whether to file the 3 `getFields()`
follow-ups as (a) one umbrella issue, (b) three issues, or (c) not at all.

**10-29 12:00Z, one-shot `rechase-13858-pr-13864-6a46` (Main checked live):** #13864 is still OPEN and a draft at
`8a17fc92e2`, with no reviews, no human or inline comments, and reviewDecision empty. Its last update was 10-22
17:28Z. **Maintainer triage on the issue:** on 10-23 13:56Z, jkwak-work unassigned jkiviluoto-nv (who was
auto-assigned by github-actions on 10-22) and assigned **kaizhangNV**, and added the label `RTR` (which has no
description). kaizhangNV is the maintainer to expect for the review. Nothing has been pushed since `8a17fc92e2`. The
dashboard session `rnc00v` has no operator reply after 10-22 17:30Z, so the follow-up decision is still pending. I
re-asked it once on the dashboard thread (options a–d). The task was not rescheduled, as the task order required.

**Resume on:** a maintainer review on #13864 (kaizhangNV is likely), the PR being marked ready or merged, and the
operator's choice on the follow-ups. Webhooks deliver the first two; there is no timer.
