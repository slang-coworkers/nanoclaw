---
type: chain
title: slang#14035 — Metal/WGSL reject `&ptr[i]` / `&ptr->field` (`operator&` gated cpp_cuda_spirv_llvm)
description: Human-filed (albertrodriguezclo) feature request 2026-10-29 17:10:18Z, cloth-sim batch. Triaged enhancement/low/P3 by slang-triager. Parked on maintainer direction (jkwak-work, aidanfnv) because `operator&` is slated for deprecation; R6 hold, re-check i14035-r6-post-30ba 2026-11-02 17:15Z.
tags: [metal, wgsl, pointers, address-of, capabilities, feature-request, parked, r6]
resource: /workspace/inbox/a2a-1793295608357-kcvdxm/triage-14035.md
---

# slang#14035 — `operator&` on a device pointer, Metal/WGSL

**Ask.** `AtomicInc(&count[i])` compiles on CUDA/SPIR-V, but gives E36107 on Metal. The cause is
`[require(cpp_cuda_spirv_llvm)] operator&` (`core.meta.slang:3091`). The reporter wants one of two things:
allow `&` on Metal (and WGSL) when the operand is reached through a device pointer, or a diagnostic that names the limitation.

**Triage (slang-triager, 10-29 17:40Z, Debug build ~01dcd3568). These are the triager's findings; I did not reproduce them.**
- Reproduced on Metal, and also on HLSL/GLSL. Metal was never in the gate: the require came in #4710, before Metal had pointers.
- The Metal back end is already ready. `__getAddress(...)` (gated `cpp_cuda_metal_spirv_llvm`, `slang-check-decl.cpp:22442`) compiles and emits `count + i`.
  `-ignore-capabilities` emits MSL that looks correct. That was checked by reading the text only; no Metal compiler was available.
- **Constraint:** maintainers plan to deprecate `operator&`: #10280, jkwak-work on #9148, jhelferty-nv on #10619, and aidanfnv's open draft #10206.
  Under #10206 there is no public way to take a field's address.
- WGSL cannot do this (it has no device pointers). The reporter's `count + i` silently emits invalid WGSL there; #13399 tracks that.
- Options: **A** widen the gate (one line); **B** add an address-of note to E36107 suggesting `p + i`
  (`diagnoseMissingCapabilityProvenance`, ~:23578); **C** land #10206 and pick a spelling for field addresses. The triager recommends B if the deprecation stands.

**GitHub state (verified 10-29 17:4xZ).** Issue Type=Feature and the `reproduced` label were set by the bot. 0 comments and no assignee.
R6 holds a bot comment until 11-02 17:10:18Z.

**Next.** The triager's one-shot `i14035-r6-post-30ba` runs 11-02 17:15Z. Its task session
`sess-1793295542513-wn3ixw` exists (verified). It posts the parked 5-bullet (A/B/C for jkwak-work/aidanfnv,
plus the workaround `count + i` / `__getAddress(p->field)`), or a delta if someone has replied. Once a maintainer picks A or B, it goes to slang-fixer.
Owner: slang-triager, thread `gh-issue-shader-slang/slang-14035`. Memo: see `resource`.
