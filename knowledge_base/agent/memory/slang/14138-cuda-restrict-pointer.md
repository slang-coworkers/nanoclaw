---
type: chain
title: slang#14138 — CUDA no-alias (`__restrict__`) pointer spelling
description: Human-filed (albertrodriguezclo) feature request 2026-11-01 14:31:37Z, cloth-sim batch. Dispatched to slang-triager under the R6 hold (no bot comment, label, PR or commit naming the issue before 2026-11-05 14:31:37Z). Main one-shot r6-release-14138-c527 at 11-05 14:35Z. Triaged 11-01 14:41Z feature/medium/P2, rec A (`restrict` on `in` pointer params); ImmutablePtr<Rec> already closes the reporter's copy kernel. PARKED on operator go-ahead + maintainer (csyonghe) surface pick.
tags: [cuda, emit, pointers, aliasing, feature-request, r6]
---

# slang#14138 — no way to mark a pointer non-aliasing on CUDA

**Ask.** A spelling for "this pointer does not alias" that the CUDA emitter turns into `__restrict__`
(proposals: `restrict` on pointer params/fields/locals, a `RestrictPtr<T>` alias like `ImmutablePtr<T>`,
or a `[NoAlias]` attribute; `noalias` on LLVM, `Restrict`/`RestrictPointer` on SPIR-V). Today `restrict`
on a pointer param is E31206, `[vk_restrict_pointer]` is E31002, `Ptr<T, Access.Read>` emits a plain `T*`.
Motivation: a 57-float record copy kernel is 4.05 ms vs 3.49 ms hand-written CUDA (+16%); a local copy
workaround reaches 3.42 ms, so the cost is the missing alias info. Repro is `na.slang` in the issue body.

**Related.** #13108 (CUDA by-value struct copies) — its triage already listed `__restrict__` on the
param as an option that needs a general aliasing guarantee. Same-day batch siblings: #14135
(`__launch_bounds__`), #14137 (`-entry` E30015).

**Dispatch (11-01, Orchestrator).** Memory grep on 14138: no hits. No existing triager session (only
my own webhook session on the thread). Dup search: only #13108. Labels: none; fences but no crash word,
so the **R6 hold applies until 2026-11-05T14:31:37Z**. Thread `gh-issue-shader-slang/slang-14138`.
Release timer is Main's `r6-release-14138-c527` (11-05 14:35Z); the triager was told not to set its own.

**Progress.** 11-01 14:36Z: the triager reproduced at master 6815ed82d (no `__restrict__`; E31206/E31002 as the reporter describes). SASS/timing on the L40S is in progress and the [Triage] memo will follow. No GitHub writes.

**[Triage] 11-01 14:41Z (slang-triager, memo `/workspace/inbox/a2a-1793544101448-ql9euv/triage-14138.md`).**
feature-request / medium / frontend+target-emit / P2, not a dup. L40S nvcc 12.6 sm_89, reporter-shape copy57 kernel:
as-is 2.08 ms, hand `__restrict__` 1.54 ms (−26%), **`ImmutablePtr<Rec>` on `src` 1.54 ms with identical SASS, so
no compiler change is needed for the headline case.** The real gap is RW buffers and non-overlapping outputs; the SASS
changes there, but the timing win was within noise. The reporter's "20 vs 40 regs" did not reproduce (40 everywhere).
Recommended approach A: relax the E31206 gate (slang-check-decl.cpp:15166) for `restrict` on concrete `in` pointer params, emit
`__restrict__` in the CUDA/C++ declarator (slang-emit-cpp.cpp:606, slang-emit-c-like.cpp:193), and add LLVM `noalias`
(slang-emit-llvm.cpp:2411). B (`RestrictPtr<T>`) rejected; C (`[NoAlias]`) is A under a second spelling; D (document ImmutablePtr) now.
Decision owner for the surface: csyonghe (#8710, #3814). Draft comment held in the triager's `memory/issues/comment-14138.md`.

**Side findings.** S1: `[vk_restrict_pointer]`/`[vk_aliased_pointer]` (hlsl.meta.slang:28825) have no
`__attributeTarget` and no consumer, so E31002 fires on every placement. I re-reproduced it on global/param/local placements
with the local Release slangc, and dedup found nothing. Filed by the triager as **#14139** (bot-filed 11-01 14:49Z, Type=Bug, `reproduced`+`SPIR-V`; verified: body has no #14138 reference and no @). **#14139 is owned by this chain, so its issue_opened webhook needs no dispatch.** No fixer chain. The issue_opened webhook arrived 11-01 14:49Z and was not dispatched; the only session on `gh-issue-shader-slang/slang-14139` is my own. S2:
TODO slang-ir-collect-global-uniforms.cpp:350 (restrict on CPU `globalParams`) — same mechanism, not filed.

**Operator decision asked 11-01 (dashboard):** start a fixer on approach A after the hold ends, or (recommended) post the triage
with the ImmutablePtr workaround on 11-05 and wait for csyonghe's surface pick. Timer: r6-release-14138-c527.

**Reporter follow-up 11-01 23:39Z ([issuecomment-6565617782](https://github.com/shader-slang/slang/issues/14138#issuecomment-6565617782)).** There is no @nv-slang-bot mention, so posting is not authorized. albertrodriguezclo independently reached the same analysis (restrict → E31206, the dead `[vk_*_pointer]` attributes, SPIR-V `maybeEmitPointerDecoration`) and asks **a maintainer** to choose between: (1) `restrict` on pointer params, dropped on inlining (their pick); (2) `RestrictPtr<T>`; (3) `[NoAlias]`. They suggest a separate small PR for `const T* __restrict__` on `ImmutablePtr<T>` entry params, and they **volunteer to implement** (front end, CUDA/C++/SPIR-V emission, tests).
⇒ My call 11-01: **no bot fixer chain**, because a bot fixer would compete with an external contributor's offer. I withdrew operator option (b) on the dashboard. The R6 hold stays. Relayed verbatim to the triager, and its 11-05 draft is to be cut down to what the reporter does not already have: the L40S data showing `ImmutablePtr<Rec>` already matches `__restrict__` SASS/timing on the copy kernel, which bears on their proposed ImmutablePtr PR, plus a plain-text #14139 mention. The draft must not answer the maintainer question and must not offer a bot PR. If a maintainer answers before 11-05, the post may be dropped (the task checks for this).

**Revised draft 11-01 23:42Z** at `/workspace/extra/ephemeral/prod-groups/slang-triager/memory/issues/comment-14138.md` (the triager's own `memory/issues/`). I read it: measurements only, explicitly no position on the spelling. It adds a row showing that `ImmutablePtr<Rec>` + `__restrict__` gives SASS identical to ImmutablePtr alone, which is relevant to the reporter's proposed ImmutablePtr PR. It names #14139 and the S2 TODO as related, and leaves `{{SHA}}` to fill on post day. No changes needed; it waits for the 11-05 release.
