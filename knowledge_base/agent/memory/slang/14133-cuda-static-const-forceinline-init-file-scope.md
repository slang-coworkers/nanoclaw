---
type: chain
title: slang#14133 — CUDA global `static const` struct from a `[ForceInline]` `__init` emitted as file-scope statements
description: Human-filed (albertrodriguezclo) bug 2026-11-01 06:24:24Z. Triaged bug/high/IR/P2 on all targets (branchy-ctor variant segfaults). Handed to slang-fixer local-only under the R6 hold until 2026-11-05T06:24:24Z. Orthogonal to #13115.
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
