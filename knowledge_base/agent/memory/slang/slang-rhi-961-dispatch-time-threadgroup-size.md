---
type: chain
title: slang-rhi#961 — Metal/CUDA dispatch with a host-chosen thread-group size, or a partial last group (dispatchThreads)
description: Human-filed (albertrodriguezclo) feature request 2026-11-01 19:28:28Z, cloth-sim porting batch. Host-side companion of slang#14136. Triaged 11-01 feature/medium/P2, both claims confirmed (rec A: one appended args-struct dispatch method). PARKED on slang-rhi maintainer API direction under R6 (to 2026-11-05 19:28:28Z); triager one-shot t-b6e981 11-05 19:30Z posts the held draft.
resource: https://github.com/shader-slang/slang-rhi/issues/961
tags: [slang-rhi, metal, cuda, dispatch, feature-request, r6]
---

# slang-rhi#961 — dispatch-time thread-group size

**Ask (reporter's claims, unverified).** The Metal backend always calls
`dispatchThreadgroups(MTL::Size(x,y,z), m_computePipeline->m_threadGroupSize)` (`src/metal/metal-command.cpp`,
indirect too), so there is no way to pick `threadsPerThreadgroup` at dispatch time and no `dispatchThreads:`
(non-uniform last group). CUDA also launches with the reflected block size. Proposal:
`dispatchComputeWithGroupSize(groupCount, threadGroupSize)` (Metal/CUDA/CPU; rejected on D3D12/VK/WGPU),
`dispatchComputeThreads(threadCount)` on Metal behind a feature query, the same for indirect, and a SlangPy
surface (`thread_group_size=`, `exact_threads=`). Reporter says 7 of 97 replayed kernels need case 1.

**Coupling.** [slang#14136](14136-metal-threads-per-threadgroup.md) is the shader side (read the dispatched
size; `WorkgroupSize()` folds to `[numthreads]`). Case 1 needs both. Also related: slang#14135
(`__launch_bounds__`), and slangpy #654 / #844 / #768 (cite as plain text in bot posts).

**Routing (11-01 ~19:30Z).** Live: open, 0 comments, no labels/type/assignees. The only session on
`gh-issue-shader-slang/slang-rhi-961` was my own webhook session. **R6:** no `bot-ok`, no crash word
("no fault is raised" is not one) → hold to **2026-11-05 19:28:28Z** (comments, PRs, commits naming #961).
Dispatched to slang-triager on that thread: verify at slang-rhi main, couple with #14136, give API options,
hold the comment locally, set a one-shot for after the hold. A feature ask: no fixer chain and no SlangPy
companion filing without the operator's go-ahead.

**11-01 19:36Z** triager acked (rhi main 30250fa); nothing posted.

**Triage (slang-triager [Report] 11-01 19:55Z, rhi main 30250fa). These are the triager's findings; I verified only
the GitHub state (0 comments, Type=Feature set by the bot 19:46:56Z, no labels) and that the t-b6e981 task session exists.**
- Both claims are true. Metal: `metal-command.cpp:900` (direct) and `:910-911` (indirect); the size comes from reflection
  (`metal-pipeline.cpp:239,259`). CUDA: `cuda-command.cpp:681-693`, with indirect as a host readback on the same path.
  `ComputePipelineDesc` has no size field.
- L40S runs: the reporter's `blockTotals` sums 256/777 at rhi's 256-thread launch and 777/777 at block 777, but
  `WorkgroupSize().x` stays 256. The per-function limit binds: an 80-register kernel has a 768-thread max.
- **Workaround for case 1:** a generic `[numthreads(N,1,1)] k<let N:int>` specialized as `k<777>` works through rhi
  on CUDA. It needs one pipeline per size and does not cover case 2.
- **Corrections to the proposal:** CPU cannot honour an override (the group loop is baked in). Non-uniform
  threadgroups need Apple4+ or a Mac GPU, so a feature query is required.
- **Options:** **A (rec.)** append one args-struct method (like `draw(const DrawArguments&)`) with an optional group
  size and thread count; **B** the reporter's flat methods; **C** pipeline-level only. ABI: per the README it is not
  guaranteed; methods are appended only, and the UUID is unchanged.
- **Coupling:** case 1 needs #961 plus slang#14136, or the generic-N workaround. With `metallib_4_0`,
  `[[required_threads_per_threadgroup]]` breaks a host override. #14135's `__launch_bounds__` would cap the CUDA override.
- Metal findings are from source and slangc output only. Memo: `/workspace/inbox/a2a-1793562936092-hqo8tl/triage-slang-rhi-961.md`;
  held draft: the triager's `memory/issues/comment-slang-rhi-961.md`.
- **Side find:** on Vulkan, `findAndCheckEntryPoint("probeGeneric<777>")` gives a SIGSEGV in end/finish/submit,
  while `specialize()` is fine. Cause unknown. Probe worktree: the triager's `slang-rhi-961-probe`. 11-01 ~20:00Z: I asked
  the triager to reduce it, find which repo owns it, dedupe, and file it if it is real, without naming #961.
  20:06Z (triager progress, unverified): the crash is in the NVIDIA driver `vkCreateComputePipelines`, reached from rhi's deferred
  resolve at finish(). The SPIR-V is identical on both paths, but slang still reports `getSpecializationParamCount()=1` after
  `findAndCheckEntryPoint("k<777>")`, so rhi treats the program as specializable. 20:11Z filed as bot **slang#14143** (Type=Bug, `reproduced`, does not
  name #961); its issue_opened webhook needed no dispatch (this chain owns it). Fixer chain + rhi-hardening filing asked
  on the dashboard ~20:15Z; re-check `recheck-14143-fixer-deci-c5df` 11-03 16:00Z.
  **20:12Z: filed as bot issue slang#14143** (Type=Bug, `reproduced`, 0 comments; I verified that it does not name #961 and
  @-mentions no one). The triager reproduced it with a standalone Slang API program at v2026.17.1 and master 6815ed82d:
  `findAndCheckEntryPoint("f<777>")` gives specialized code but `getSpecializationParamCount()==1`. slang-rhi then builds a
  virtual pipeline whose VK layout skips descriptor sets (`vk-shader-object-layout.cpp:762`), and the driver segfaults.
  Suspected cause: `EntryPoint::_collectShaderParams` (`slang-check-shader.cpp:889`). Dedupe found no match.
  **#14143 is owned by this chain; its issue_opened webhook needs no dispatch.** Two decisions are with the operator
  (asked 11-01 20:15Z): a fixer chain for #14143, and a separate slang-rhi hardening issue (reject a still-specializable
  program after specialization). My one-shot `recheck-14143-fixer-deci-c5df` runs 11-03 16:00Z. The repro is in the triager's
  `scratch-961/specparam/`.

**Next.** At t-b6e981 (11-05 19:30Z): post the draft, or reply to a human comment. A slang-rhi maintainer picks A/B/C
and the names. No fixer chain and no SlangPy issue without the operator's go-ahead. The SlangPy recommendation
(`thread_group_size=`/`exact_threads=` on the raw path, `sgl command.cpp:227`) is in the memo.
