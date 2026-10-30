---
type: chain
title: slang#14066 — Result<void,E> error extraction returns the whole result struct instead of the error
description: Human-filed by kaizhangNV (MEMBER, self-assigned) 2026-10-29 23:09:26Z, found during portable-RT work. Triaged bug/high/P2 by slang-triager 23:22Z (reproduces on all targets; new silent-wrong-value rethrow case). Parked, owned by the reporter; R6 one-shot t-5fbc4b runs 2026-11-02 23:15Z.
tags: [ir, result-type-lowering, error-handling, throws, spirv, hlsl, r6]
resource: https://github.com/shader-slang/slang/issues/14066
---

# slang#14066 — `Result<void,E>` error extraction

**Ask.** `try fail(code)` on a `void ... throws uint` function, caught with `catch (error : uint)`, returns the
`ResultType` struct from the catch branch. HLSL output is invalid, and spirv-val reports an `OpReturnValue` type mismatch.
The reporter's stated root cause: `ResultTypeLoweringContext::getLoweredResultType` lowers every `Result<T,E>`
(including `Result<void,E>`) to `{bool tag, AnyValue storage}`, but `getResultError` returns the entire result when
`valueType` is absent. It should unpack the error storage whatever the success type is. Expected output: element i = i+17.

**Routing (10-29 ~23:1xZ).** Live check: open, 0 comments, no labels, no Type, assignee kaizhangNV (self). Memory grep for
14066 had no hit. kaizhangNV's open #14051 (portable RT frontend, 10-29 20:20Z) touches no result/error-lowering file,
so the fix is not already in flight there. Dispatched to slang-triager on `gh-issue-shader-slang/slang-14066` with the
R6 hold (fences, but no crash word and no `bot-ok`). Because the reporter is a self-assigned maintainer who has already
named the fix, the triager must not hand off to the fixer or open a PR without the reporter's go-ahead.
Precedent for self-assigned maintainer issues: [13752](13752-shadowing-diagnostics.md).

**Triage (slang-triager, 10-29 23:22Z, ToT 1f0b33b86; these are the triager's findings, I did not reproduce them).**
bug / high / IR / P2. Not a duplicate and not a user-visible regression: `catch` arrived in #6916 (57c3f9382, v2025.10), so the catch path never worked.
Sibling [14067](14067-ir-validate-throw-terminator.md) (same reporter) has a different root cause.
- It reproduces on ToT and v2026.13.1. Every target emits the bad return: HLSL, SPIR-V, GLSL, Metal, WGSL, CUDA and CPU.
  CUDA and CPU fail to compile downstream, and Vulkan on the L40S segfaults in the driver.
- The reporter's root cause is right. `getResultError` (`slang-ir-lower-result-type.cpp:155-172`) has the pass's only void shortcut,
  left over from before #6916, when `Result<void,E>` lowered to plain `E`. The other Result ops are correct for void.
  The DLL-export wrapper (`marshal-native-call.cpp:276`) uses the same branch.
- **New, not in the issue:** a rethrow through a non-void function gives a silent wrong value, with no invalid code.
  Example: `uint relayValue() throws uint { try fail(c); return 5; }` packs `tag ? 1 : 0` as the error, so Vulkan/CUDA/CPU print `1 1`, not `60 61`.
- The tests miss it because peephole (`slang-ir-peephole.cpp:419`) folds `GetResultError(MakeResultError(e))` after inlining. A test needs `[noinline]`.
- Recommended fix A: always run fieldExtract + unpackAnyValue (about −8 lines). The triager rejected B (restore `void→E`) and C (`{tag,E}`).
- Unrelated: `marshal-native-call.cpp` ~:332 passes `resultVar` twice, so `errorVar` never reaches the native call (since 2022). The triager did not act on it.

**Parked 10-29 23:22Z,** owned by the reporter. No fixer, no PR, nothing on GitHub (R6). The one-shot **t-5fbc4b** runs 2026-11-02 23:15Z,
after the hold ends at 23:09:26Z. It first checks for a reporter PR or a maintainer comment. If there is neither, it posts the draft
`comment-14066.md`, then adds `reproduced` + Type=Bug only if the issue still has no labels and no Type.
Owner: slang-triager on `gh-issue-shader-slang/slang-14066`. Memo: `/workspace/inbox/a2a-1793316138422-wcegif/triage-14066.md`
(triager copy: `memory/issues/14066.md`).

**Reporter PR #14068 (10-29 23:35Z, 26 min after filing).** kaizhangNV opened fork PR #14068 "Extract packed errors from void result types"
(branch `codex/fix-void-result-error`, Closes #14066): `slang-ir-lower-result-type.cpp` +8/-13 (fix-A shape) plus a new
`tests/language-feature/error-handling/void-error-value.slang`. Head 68d0235d at 10-30; CI 56 pass, 1 fail (fleet-wide SlangPy Tests break).
Its 10-30 `pr_ready_for_review` was **not** forwarded: slang-pr-approver is paused; queued in `data/approver-pause-queue.md`.
The t-5fbc4b one-shot's "reporter PR exists" branch now applies, so it should not post the triage draft on the issue.
