---
type: chain
title: slang#14133 — CUDA global `static const` struct from a `[ForceInline]` `__init` emitted as file-scope statements
description: Human-filed (albertrodriguezclo) bug 2026-11-01. Triaged bug/high/IR/P2. Reporter PR #14150 MERGED 11-03 02:06Z with our 2 flagged regressions unaddressed; G2 later filed by a human as #14235 (own PR #14236), G1 being verified/filed by the triager. Side finding #14217 (filed-only).
tags: [cuda, emit, ir, static-const, force-inline, legalize-global-values, r6]
---

# slang#14133 — `[ForceInline] __init` global constant → file-scope assignments on CUDA

**Ask.** `static const S kZero = S(0.0f, 0.0f);` where `S.__init` is `[ForceInline]` emits
`__device__ S_0 _S1;` followed by `(&_S1)->a_0 = 0.0f;` **at file scope** on `-target cuda`;
nvcc 12.8 rejects each line. Without `[ForceInline]` the init calls `S_x24init_0` and compiles.
Expected: a constant initializer or folding into uses. Seen on 2026.16.1 and upstream master.
Reporter cites #13107 as related. Workaround: a function returning the value.

**Routing (11-01 ~06:3xZ).** `grep 14133` found no prior record. Live check: open, 0 comments,
no labels, no assignee, empty timeline (no reporter PR yet), no triager session (only Main's
`sess-1793514266152-ji3fz3`). slang-triager not paused. Dispatched on
`gh-issue-shader-slang/slang-14133` with the **R6 hold**: the nvcc `error:` lines are a
downstream diagnostic, not a crash word (precedent [14037](14037-cuda-half-enable-define.md)),
no `bot-ok` → no bot comment, PR, or issue-naming commit before **2026-11-05T06:24:24Z**.

**Overlap to check.** [13107](13107-cuda-static-const-struct-array.md) / draft PR #13115 owns the
`inlineGlobalConstantsForLegalization` / `$init`→`makeStruct` fold for static const struct
tables (head `04d59c59ed`; narrowed `a6d49136bf` held unpushed by slang-fixer, budget-blocked).
The triager must say whether #14133 is the same producer (global init block left un-hoisted after
ForceInline) or a distinct one, and whether #13115 fixes, worsens, or is orthogonal to it.

**Triage (11-01 06:38Z, slang-triager).** bug/high/IR/P2, **all targets** (HLSL/GLSL/Metal/WGSL/C++
emit file-scope stmts; SPIR-V fails spirv-val), default opt and `-O0`. Not a regression, not a dup.
Type=Bug + `reproduced` set. Cause (triager's finding): `replaceGlobalConstants` leaves a module-scope
`call S.$init`; the first `performForceInlining` (`slang-emit.cpp:1864`) visits module-scope call sites
(`considerAllCallSitesRec`, `slang-ir-inline.cpp:80-98`) and `inlineSingleBlockFuncBody` copies
var/store/load into module scope. **A branchy `[ForceInline]` ctor segfaults Release slangc** (Debug:
assert `slang-ir-inline.cpp(767) as<IRBlock>(callerBlock)`). **#13115 is orthogonal:** it runs later
(~`:1973`), and it makes `static const S arr[2]={S(..),S(..)}` slightly worse. Fix A (recommended): the
inliner declines a module-scope call site unless the callee body is all module-scope-legal; then
`inlineGlobalConstantsForLegalization` and the second ForceInline (`:2724`) handle it inside the
function. PR #12749 (`fix/issue-12623`, open, not draft) also edits `slang-ir-inline.cpp`. Memo:
inbox `a2a-1793515099227-k7nyeq/triage-14133.md`. Triager's hold re-check one-shot `t-cca1b9`
(11-05 06:30Z) posts its draft comment.

**My spot-check (11-01, local Release slangc at `6815ed82d5`):** CUDA and HLSL both emit the file-scope
assignments, and the branchy-ctor variant segfaults (exit 139). Both confirmed.

**Decisions (11-01).** (1) Hand to slang-fixer now, local-only until 11-05T06:24:24Z. The triager sends
the handoff on the canonical thread. (2) **R6 stays.** The crash exemption covers an issue *as filed*
(the reporter's own crash word plus a fence). A crash the bot finds while triaging does not make the
issue exempt. The bot's post and PR after the hold mention the crash, and the fix pins it with a test.
No separate issue, because the cause is the same.

**Handoff (11-01 06:40Z).** Triager sent `[Triage handoff]` to slang-fixer (msg 21) with all the
constraints; fixer acked, local worktree. Next: fixer `[Fix Report]` → triager `[Triage Resolution]`
to me; t-cca1b9 posts the issue comment 11-05 06:30Z. PR opens only after 11-05T06:24:24Z.

**Fix (11-01 08:11Z, slang-fixer).** Local branch `fix/issue-14133` (fixer's `wt-slang-14133`, base
`6815ed82d`, 2 commits, 3 files +193/−9, commit msgs don't name the issue). Approach A in `canInline`
(`slang-ir-inline.cpp:343`): a module-scope call site is inlined only when the callee is a single block
of values (no var/load/statement; debug insts skipped). Acceptance 1–6 ✅. Full suite 11369/11372; the 3
failures are `fp8-cuda*` (fixer says they also fail on master: CUDA_ERROR_INVALID_PTX on L40S). Publish
one-shot `t-200322` at 11-05 06:45Z: stand-down check, merge master, full suite, push, **draft** PR,
review request to slang-reviewer. Handoff file: fixer `reports/slang-14133-handoff.md`.

**Side finding (pre-existing, not in this fix).** With `-g`, `static const S arr[2] = {S(..),S(..)}` (plain
ctor) leaves **dead** `__device__ static const S_0 _S1 = S_x24init_0(1.0f,1.0f);` globals, which NVRTC rejects
as dynamic init. Without `-g` they're gone. I confirmed this on local Release `6815ed82d5` (`_S1` appears
once, so it's unused). Per the fixer, C++/GLSL/Metal/WGSL reject it too. Two quick `gh search` queries found
nothing. Sent to the triager for a full dedup and a local draft; filing a new issue goes to the operator.
The array test uses `-xslang -g0` to dodge it, and the PR body must disclose that.

**Side finding: dedup done (11-01 08:17Z, triager).** Not a duplicate. A regression from v2026.1.2:
1.1 is clean, and the triager says the cause is #9860 `e9cc1f671` (no commit bisect run). Producer, per
the triager: (a) `inlineGlobalValuesAndRemoveIfUnused` (`legalize-global-values.cpp:45-48`) deletes only
the root and leaves the element `call S.$init` orphans; (b) with `-g`, the callee's debug insts block
`[readNone]` inference (#9860); (c) DCE keeps calls that might have side effects. Downstream results:
NVRTC, gcc and glslang reject the output; Metal and WGSL output is invalid; DXIL and direct SPIR-V pass.
The draft issue text is in [raw/triage-14133-sidefind-g-dead-globals.md](raw/triage-14133-sidefind-g-dead-globals.md).
⚠️ **The draft names #14133**, so filing it before 11-05T06:24:24Z would add a cross-reference to the
#14133 timeline (R6). Asked the operator 11-01 08:2xZ to file or not file; I recommended filing after
the hold ends. Re-check one-shot `recheck-14133-g-sidefind-beac` runs 11-05 07:15Z.

**Reporter PR #14150 (11-03, Main sess-1793666763161-jjrjki).** albertrodriguezclo opened fork PR #14150
(`fix/cuda-static-const-struct-init`, head `d79256b0f8`, created 11-01 23:54Z, ready 11-03). "Fixes #14133" =
Fix A (`isInlinableAtGlobalScope` in `canInline`), +84/−0, jkwak-work APPROVED, CI green. Approver paused →
queued in `data/approver-pause-queue.md`. No session on this thread had acted on the **R6 retirement (11-02)**:
the fixer and triager sessions were silent since 11-01 08:18Z, and one-shots `t-200322`/`t-cca1b9` still held for
11-05. Sent the triager (pinned `sess-1793514365085-a6bfnv`, msg id 19) four things: fixer stands down with no
competing PR and drops `t-200322`; diff its local fix vs #14150 and report only real gaps (no branchy-ctor test, no
GLSL/Metal/WGSL/SPIR-V lanes, `-g` debug insts vs `mightHaveSideEffects`); post the triage comment now and cancel
`t-cca1b9`; file the `-g` dead-globals side finding now (no operator go-ahead needed). `recheck-14133-g-sidefind-beac`
(11-05 07:15Z, my group) becomes a verify-it-was-filed check.

**11-03 00:46–00:50Z: superseded by the reporter's PR #14150.** albertrodriguezclo opened fork PR **#14150**
("Fixes #14133"; head `d79256b0f8`; Fix A as `isInlinableAtGlobalScope` in `InliningPassBase::canInline`;
jkwak-work approved; CI green). Sibling Main session `sess-1793666763161-jjrjki` (thread
`gh-pr-shader-slang/slang-14150`) handled the `pr_ready_for_review` webhook. It queued the approver forward
in `data/approver-pause-queue.md` because the approver is paused, and told the triager (its msg 19 →
triager row 20) that the R6 hold is gone (retired 11-02, see Core Memory). The triager is standing the fixer
down (so `t-200322` must be cancelled, not published), checking whether #14150 covers the branchy-ctor
segfault, posting the #14133 triage comment, and **filing the `-g` side finding now**. Filing a deduped bug
needs no operator go-ahead, so my 11-01 dashboard ask was over-gated: I withdrew it and cancelled
`recheck-14133-g-sidefind-beac`. Waiting on the triager's `[Triage Resolution]` with the new issue number
and confirmation that the fixer stood down.

**11-03 00:51:54Z: side finding FILED as #14217** (by slang-triager, from the draft in
[raw/triage-14133-sidefind-g-dead-globals.md](raw/triage-14133-sidefind-g-dead-globals.md), text unchanged).
Main-verified 11-03: author nv-slang-bot[bot], Type=Bug, labels `regression` + `reproduced`, no assignee,
no @-mentions. Body cites #9860 (cause), #14216 (a different `-g` issue), and #14133/#13107 (same path).
⚠️ **#14217's `issue_opened` webhook belongs to this chain, so do not dispatch it.** It is filed-only, with no
fixer chain unless a maintainer asks. A human comment on it goes to the triager (`sess-1793514365085-a6bfnv`)
as a live inbound. Still open: the triager's `[Triage Resolution]` (fixer stand-down, `t-200322`/`t-cca1b9`
cancelled, #14150 gap diff).

**`[Triage Resolution]` (11-03 00:57Z, triager).** The triager verified #14150 head `d79256b0f` on a local build:
4 repros × 7 targets × {default, `-O0`} are clean, spirv-val passes, nvcc/NVRTC compile, and the **branchy-ctor
segfault is fixed** (`getNextBlock()` check). Debug-assert item checked by code reading only. Triage comment
6592497696 posted on #14133. `t-cca1b9` and `t-200322` were cancelled; the fixer keeps `fix/issue-14133` local
and unpushed, and is diffing it against #14150 to find gaps. Triager-found gaps in #14150: (a) no
branchy-ctor test; (b) only cuda/cpp/hlsl/cpu lanes are tested; (c) `-g` makes the guard over-refuse
(correct output, and `array -g` is #14217).
**My decisions (11-03).** #14217 stays filed-only (same as the sibling's call). **Nothing goes on #14150
for coverage-only gaps** (a/b/c): the PR is maintainer-approved with CI green, and the #14133 comment
already says #14150 covers the crash. Only a correctness gap goes there: a wrong output, crash or assert on
a case #14150 is meant to fix. It needs a repro and comes to me before any post. On #14150 merge: the fixer
deletes its branch/worktree, the triager closes, and the chain is done.

**11-03 01:08Z: #14150 introduces two regressions against master** (the fixer found them; the triager reproduced
both on its own Release builds of master `6815ed82d` and #14150 head `d79256b0f`). G1: a `[ForceInline]`
helper doing integer `/` with a non-literal divisor, in `static const int arr[2]`. G2: any pure
`[ForceInline]` helper in a scalar array under `-g`. On #14150 the call stays in the module-scope initializer,
and NVRTC, glslang and C++ reject it. Cause: `isInlinableAtGlobalScope` refuses any `mightHaveSideEffects()`
inst, which includes int div/rem with a non-literal divisor (`slang-ir.cpp:9799`) and debug insts. A scalar
array root is a legal global, so legalization never moves the call into a function. The triager's brief
assumed the struct-only case and missed this.
**Main-verified 11-03:** on master, G1 and G2 `-g` fold to `{3,4}`/`{2.0,4.0}` and `-target ptx` passes; the
#14150 diff refuses on `mightHaveSideEffects()` in its `default:` case. I did not build the #14150 head myself
(two agents reproduced it there). **Approved the triager's draft comment as written**
([raw/comment-14150-regressions.md](raw/comment-14150-regressions.md)). It contains no verdict and no
@-mentions, and suggests skipping debug insts and refusing only no-use side-effecting insts.
**Posted 11-03 01:10Z:** #14150 comment **6592707618**. The triager watches #14150 (replies, head, merge) and
#14217 (human comments) with self-re-arming one-shot `t-700e05` (first run 11-03 13:00Z). A human PR without
a bot mention may not raise a webhook to us, so this poll is the backstop. The fixer still holds
`fix/issue-14133` locally. Patch requests come to Main first, and nothing is pushed to the fork.

**11-03 02:06:54Z: #14150 MERGED** at `d79256b0f` (merge `76a45e10c1`), with no change after 6592707618, so G1
and G2 are on master. **07:15Z: G2 filed by a human as #14235** (jvepsalainen-nv), with own fix PR #14236
(debug-inst skip only). See [14235](14235-cuda-global-const-g-debug-inline.md). 07:18Z: sent this triager session
the follow-up (verify, file G1 if it still fails, re-aim `t-700e05`); acked 07:20Z.

**11-03 07:28Z: G1 filed as #14238** (bot, by the #14133 triager; Type=Bug, `regression` + `reproduced`, no
assignee). It fails on master `76a45e10c` and on #14236 head `4c34875db` (the triager tested both). The
triager's `[Triage Resolution]` reached this Main session (row 70, 07:29Z); `t-700e05` was re-aimed (first
run 19:00Z, daily) to watch #14236, #14217, #14235 and #14238. ⚠️ **#14238's `issue_opened` belongs to this
chain, so do not dispatch it** (the #14238-thread Main session `sess-1793690897967-0o6crb` checked and sent
nothing). **07:30:40Z: this session asked the operator** whether to start a fixer chain for #14238. The
recommendation is yes: a scoped draft PR that refuses side-effecting insts only when they have no uses. The
fixer holds the patch locally on `fix/issue-14133`. If there is no answer, nothing starts.
