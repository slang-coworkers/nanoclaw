---
type: project
name: project_13480_bitcast_struct_with_resource_ice
description: "slang#13480 (ArmandLfd, 10-07): bit_cast between two structs that hold a resource (slangpy Tensor→PrimalTensor) ICEs E99997 on all 7 targets; not a regression (2024.1.1+). Triaged 14:31Z (cmt 6040166579). Orchestrator GO 10-07 for a draft PR on A′ (opaque-leaf pre-pass; E41205 gated on resource legalization); draft PR #13507 opened 10-08. WGSL POD bit_cast segfault side finding = new symptom of #13380 (fixed by draft #13381), NOT filed separately."
metadata:
  node_type: memory
  type: project
---

# slang#13480 — bit_cast of a struct containing a resource ICEs

**Issue.** Reporter ArmandLfd (external). `bit_cast<PrimalTensor<float,3>, Tensor<float,3>>(t._grad_in)` → E99997
"non-simple operand(s)!". The reporter said Vulkan-only; the triager showed all 7 targets, and it reproduces without slangpy:
`struct A{StructuredBuffer<float> d; uint o;}` → identical `B`. Not a regression (2024.1.1 → 2026.19 all fail).
No assignee, no milestone.

**Root cause (triager, Orchestrator re-repro'd the ICE at eaf758404 on spirv/hlsl/cuda).**
legalizeResourceTypes (slang-emit.cpp:2039) splits the struct before lowerBitCast (:2593); legalizeInst has no BitCast
case → default arm (slang-ir-legalize-types.cpp:2208). CUDA/CPP: lowerBitCast readObject has no resource leaf (:230).

**Decision 10-07.** Orchestrator GO for a draft PR on Approach A, on the #13461 precedent (unassigned issue, no maintainer
owner → Orchestrator may release; drafts-only still holds). Routed through slang-triager (it holds the fixer briefing).
Open design points go into the draft PR as questions: matching rule, arrays of handles, CUDA byte semantics, doc at
core.meta.slang:3441.

**Side finding (verified by Orchestrator at eaf758404):** WGSL segfault rc 139 on a POD bit_cast of
`struct{uint s[3]; uint o}` from a uniform; spirv OK. Range corrected by the #13381 fixer 15:29Z: 2025.1/2025.6.1 OK, 2025.6.2+ crash (2025.7–2025.10 untested, glibc); the triager's first figure of 2025.12+ was too narrow. **14:46Z triager dedup:** it's a dup of
#13380 (typeless swizzle from the peephole VectorReshape fold → isValueType(null) in simplifyForEmit). Triager's check:
#13381 head 0bd7ae502a makes it compile, reverting brings back rc 139. Disposition (a): the triager posted the crash shape (cmt 6040577868, 14:53Z, verified live) on
#13380, and Orchestrator asked the #13381 owner (slang-fixer `sess-1790902405168-47vkqg`, thread `-13380`) to add it as
a second regression test. Pushed 15:29Z: head `5a1d1474e9` (FF, test-only `tests/wgsl/cbuffer-scalar-array-bitcast.slang`, verified live, still a draft); the fixer requested the slang-reviewer re-review itself; CI blocked by a GitHub Actions outage (fixer's claim). 17:28Z #13381 re-review at 5a1d147: APPROVE_WITH_NITS (A+C only, Devin timed out), CI held by the priority gate. The fixer found that v2025.1/6/6.1 don't crash but do emit the #13380 undeclared-temp miscompile, and the triager qualified "rc 0" in 6040577868 in place at 17:35Z (verified live; 2 comments). R3-N2 (five-part vs concise body) answered: keep concise, since the explain-diff hook enforces it. Triager edited 6040577868 in place 15:33Z with the tested-only range (verified live: 1697 chars, 2 comments, no stale "2025.12+").

**15:17Z A′ (approved by Orchestrator):** E41205 fires only under `shouldLegalizeExistentialAndResourceTypes`; CUDA/CPU keep byte lowering (c2 `struct{Texture2D,uint}→struct{uint64_t,uint}` compiles on master cuda/cpp, verified); the :230 ICE becomes E41205.

**16:51Z A′ refined (triager-approved; Orchestrator accepted):** positional pairs must be identical, opaque-free with
equal natural size+alignment, or a recursive match. That rejects f1 `{SB; u8; u8[4]}→{SB; u8; uint}`, which master rejects too
(E41202 cuda/cpp, E99997 spirv; re-verified at eaf758404). LLVM exception: `lowerCPUResourceTypes` (emit.cpp:2281)
already turns handles into pointers before lowerBitCast, so the rewrite changes LLVM codegen but not the values; runtime tests pin it.

**10-08 01:33Z draft PR [#13507](https://github.com/shader-slang/slang/pull/13507)** (verified live): head `c3e4409dfc`,
branch `fix/issue-13480`, 4 nv-slang-bot commits with no Claude trailer, `pr: non-breaking`, closes 13480, 11 files +530/−1. The body is
concise and carries a one-line blocking-merge question, the "#13380 unrelated" note and the Discord-origin link. Board-sync assigned
jhelferty-nv and requested their review (01:28Z). Triager issue cmt 6050341675. Refinements: the pre-pass only fires on a struct holding
a handle (or an array of such structs); `[[vk::offset]]` is compared by computed offset. 7 tests, 5 red on master; local suite
7609/7610 (gfx-smoke fails on master too). CI not run (draft; dispatch 37713079423 waiting at the priority gate). Next: slang-reviewer
verdict → fixer [Fix Report] → triager [Triage Resolution]. **Discord note is deferred to merge**: Orchestrator routes it to
slang-discord-support (thread 1555956709565145230) when #13507 merges.

**10-08 02:02Z jkwak-work asked @nv-slang-bot (cmt 6050655801):** what is the difference between bit_cast and reinterpret, and does
reinterpret do more processing at runtime? Orchestrator routed it verbatim to slang-triager on the canonical thread with
`<github-post-authorized />` so the triager can post the answer. **Answered 02:15Z, cmt 6050799354** (verified live: 3910 chars, @jkwak-work, disclaimer; Orchestrator spot-checked processReinterpret against source: max(from,to) size, AnyValue pack/unpack, no equality check). Gist: different lowering; reinterpret emits pack/unpack helpers on HLSL/CUDA, SPIR-V -O3 output nearly identical; on this shape reinterpret is not a working workaround either.

**Discord origin (15:59Z, jkwak-work cmt 6041686705, + label `DiscordRequest`):** filed from Discord thread
1555956709565145230 (armandlfd). slang-discord-support (`sess-1791039398403-ull2v4`) answered 10-03 with the same
field-by-field workaround and called the ICE a compiler bug. jkwak-work asked for the filing on 10-06; the reporter linked the issue back
there 10-07 12:36Z. The comment is provenance only, with no ask: no GitHub reply, no Discord post.

**Resume.** Re-chase task `rechase-13480-draft-pr-ace0`. Thread `gh-issue-shader-slang/slang-13480`.
