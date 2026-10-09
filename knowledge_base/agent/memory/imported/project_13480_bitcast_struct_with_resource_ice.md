---
type: project
name: project_13480_bitcast_struct_with_resource_ice
description: "[RESTING on maintainer review/CI release since 10-08 13:40Z] slang#13480 (ArmandLfd, 10-07): bit_cast between two structs that hold a resource (slangpy Tensor→PrimalTensor) ICEs E99997 on all 7 targets; not a regression (2024.1.1+). Triaged 14:31Z (cmt 6040166579). Orchestrator GO 10-07 for a draft PR on A′ (opaque-leaf pre-pass; E41205 gated on resource legalization); draft PR #13507 opened 10-08. WGSL POD bit_cast segfault side finding = new symptom of #13380 (fixed by draft #13381), NOT filed separately."
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

**10-08 03:02Z slang-reviewer: REQUEST_CHANGES at c3e4409dfc** (1 bug, 6 gaps, 2 questions; the fixer requested it, the reviewer CC'd Orchestrator).
Core fix verified: the real slangpy repro compiles on all 7 targets. B1: `bit-cast-resource-array.slang` fails CI spirv-val (handle-array→bytes row,
pre-existing behaviour now pinned by a test). G1: vacuous checks, including `filecheck=A,B` enforcing only the first prefix, which is the #13359 class.
G2–G6 cover untested rejection branches, Release-UB `cast<>`, diagnostic text, stale comments and duplication. Q2: struct{SB}→uint4
still ICEs on cuda/cpp (pre-existing). The fixer reportedly has a local fix 370008fbcc for B1+G1. Devin skipped (timed out twice). The fixer owns the loop.

**10-08 04:26Z round-2 push**: head `579d248d0c` (5 commits after c3e4409dfc, verified live, still a draft, 0 reviews). Fixer's 04:33Z
[Fix Review Request] reached slang-reviewer `sess-1791423013872-rph0le`, which is **cost-ESCALATED** ($60.97 / cap $50 / ceiling $75) and has been
silent since. The 13:00Z re-chase nudged the triager; the triager (13:16Z) asked the fixer for a scoped delta review. **13:20Z operator asked** on the dashboard:
A raise ceiling (set-ceiling → $100; the reviewer group's 30d p95 is $42.61, max $82.41), B fresh reviewer session, C skip peer round 2.
The ask timed out unanswered and became **moot at 13:26Z**: the reviewer ran the scoped delta review in about $2 ($62.97/$75) → **APPROVE (scoped)** at 579d248d0c, all 9 round-1 items resolved, 42/42 bit-cast tests with spirv-val. Lesson: an escalated session (not stopped) can still finish a small scoped task under its ceiling. Never `continue`/`set-ceiling` without the operator.

**10-08 13:40Z [Triage Resolution]: chain RESTS on humans** (verified live: draft, head `579d248d0c`, 15 files +745/−3, closes 13480,
0 GitHub reviews, checks 6 success / 56 skipped, dispatch 37727913617 `waiting`). 11 new tests (9 red on master); full suite with spirv-val
7624/7625; probe matrix 92×8 shows no regressions. Waiting on: (1) a maintainer review plus answers to the 4 merge-blocking questions
(explanation cmt 6050284690); jhelferty-nv was assigned and review-requested by board-sync; (2) a human to release CI (falcor gate +
priority gate); (3) the operator's ready flip after CI. On merge: Discord note via slang-discord-support (thread 1555956709565145230).

**10-08 02:02Z jkwak-work asked @nv-slang-bot (cmt 6050655801):** what is the difference between bit_cast and reinterpret, and does
reinterpret do more processing at runtime? Orchestrator routed it verbatim to slang-triager on the canonical thread with
`<github-post-authorized />` so the triager can post the answer. **Answered 02:15Z, cmt 6050799354** (verified live: 3910 chars, @jkwak-work, disclaimer; Orchestrator spot-checked processReinterpret against source: max(from,to) size, AnyValue pack/unpack, no equality check). Gist: different lowering; reinterpret emits pack/unpack helpers on HLSL/CUDA, SPIR-V -O3 output nearly identical; on this shape reinterpret is not a working workaround either.

**Discord origin (15:59Z, jkwak-work cmt 6041686705, + label `DiscordRequest`):** filed from Discord thread
1555956709565145230 (armandlfd). slang-discord-support (`sess-1791039398403-ull2v4`) answered 10-03 with the same
field-by-field workaround and called the ICE a compiler bug. jkwak-work asked for the filing on 10-06; the reporter linked the issue back
there 10-07 12:36Z. The comment is provenance only, with no ask: no GitHub reply, no Discord post.

**10-08 13:00Z re-chase: round 2 stalled.** The fixer pushed 5 commits `370008fbcc`..`579d248d0c` (verified live; head `579d248d0c`, 04:26Z)
and sent the round-2 [Fix Review Request] at 04:33Z to reviewer `sess-1791423013872-rph0le`. That session never answered: cost `escalated`
at $60.97 against cap $50 and ceiling $75. Tier-1 is advisory, not blocking, but round 1 cost about $60, so round 2 there is likely to hit the
ceiling. Orchestrator nudged the triager once (msg 61) and reported it to the dashboard (msg 69). CI dispatch 37727913617 is waiting at the priority gate.
There were no non-bot comments after 02:02:47Z. #13381 CI (37644780423) has been at the same gate since 10-07 15:33Z.

**Resume.** Re-chase task `rechase-13480-draft-pr-b224` (10-09 13:00Z; the predecessor `-ace0` was a consumed one-shot). If round 2
still hasn't moved, escalate to the dashboard. Do not nudge the triager a second time. Thread `gh-issue-shader-slang/slang-13480`.
