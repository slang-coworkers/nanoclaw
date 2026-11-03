---
type: chain
title: slang#14035 — Metal/WGSL reject `&ptr[i]` / `&ptr->field` (`operator&` gated cpp_cuda_spirv_llvm)
description: Human-filed (albertrodriguezclo) feature request 2026-10-29 17:10:18Z, cloth-sim batch. Triaged enhancement/low/P3 by slang-triager. Parked on maintainer direction (jkwak-work, aidanfnv) because `operator&` is slated for deprecation; Parked 5-bullet posted 2026-11-02 17:16Z (comment 6583479145); re-check t-b1a9ee 2026-11-09 17:15Z.
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

**11-02 R6 re-check (verified).** At 17:15Z the triager found no drift and re-verified at master 8229f2742: the gate is unchanged, #10206 is still a draft, and #10280 is merged.
It posted the parked 5-bullet as comment **6583479145** (nv-slang-bot, 17:16:09Z, 1 comment total, verified), which pings @jkwak-work/@aidanfnv for A/B/C.

**Next.** The triager's one-shot `t-b1a9ee` runs 2026-11-09 17:15Z. If a maintainer picks A or B, it sends a [Triage handoff] to slang-fixer; option C stays parked.
Owner: slang-triager, thread `gh-issue-shader-slang/slang-14035`. Memo: see `resource`.
