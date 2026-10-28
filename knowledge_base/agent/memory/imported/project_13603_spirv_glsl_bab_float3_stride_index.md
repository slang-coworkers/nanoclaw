---
type: project
name: project_13603_spirv_glsl_bab_float3_stride_index
description: "slang#13603 (bot-filed 10-13 15:18Z by slang-fixer while applying #11803 R2 nits): on SPIR-V/GLSL, plain ByteAddressBuffer Load<float3>/Store<float3> at a non-zero multiple of 12 index the stride-16 v3float alias by offset/12 -> wrong bytes, silent. Pre-existing on master, separate from #11803, sibling of closed #9931. Owned by the #11545 chain; NO fixer dispatched. 10-15: operator asked for triage; Main found the struct-member/immediate-offset case is a REGRESSION since v2026.11 (#11430 by code trace), slang-triager posted it 11:51Z (issuecomment-6191375234, labels regression+reproduced, Type Bug, #11430 confirmed by build bisect); r1 (10-20) found it still quiet and asked the operator dispatch/wait/ping; r2 (10-27) no answer, #11803 merged 10-22 without fixing it, re-verified on master 9a4817c881; r3 rechase-slang-13603-r3-6781 11-03 15:00Z is the LAST (R11 3/3). The 10-13 recurring gate is gone (R10)."
metadata:
  node_type: memory
  type: project
---

# slang#13603: SPIR-V/GLSL plain BAB `Load<float3>(12)` reads bytes 16–27

**Origin.** slang-fixer session `sess-1781189172097-tx3d2b` (thread `gh-issue-shader-slang/slang-11545`) found it while
applying the #11803 R2 nits (the `Load<float3>` doc contradiction, R2-a). It is listed in the fixer's `[Fix Report]` to
the dashboard Main (row 500406, 15:20Z), and the dashboard Main's 5-bullet (row 500409, 15:20:47Z) already told the
operator about it as "separate from this PR". See [[project_11545_bytebuffer_alignment_chunker_stack]].

**Content.** `emitSimpleLoad`/`emitSimpleStore` (`slang-ir-byte-address-legalize.cpp`) with
`translateToStructuredBufferOps` turn the byte offset into an index by dividing by the natural stride (12 for `float3`),
but the aliased structured buffer is std430 with `ArrayStride 16`. With no alignment argument, `isWideAccessAligned`
accepts any literal multiple of 12. Main reproduced it on the local Release build: SPIR-V `%uint_1`/`%uint_3`,
GLSL `buffer_0._data[3U] = buffer_0._data[uint(1U)]`. HLSL/CUDA/C++ index by byte and are fine. Related: #9931 (closed).

**Disposition: owned, nothing dispatched.** The `issue_opened` webhook was the filing's self-echo. The owner ladder hit
on rung 7 (fixer row 228's learning + Fix Report) and rung 8 (dashboard Main already reported it). Neither armed a resume
trigger, so the webhook session armed `i13603-maintainer-gate-af2c` (`gates/i13603-maintainer-gate.sh`, wraps
`i13433-decision-gate.sh`; controls passed: quiet, STALE, CLOSED #12457, HUMAN_REPLY #13433 w/ early SINCE, bot-only #13530).

**Resume path.** A non-bot comment routes on `gh-issue-shader-slang/slang-13603`: fix go-ahead → slang-fixer (must not
land inside #11803 unless the maintainer says so), question → slang-triager. STALE → ask the operator whether to dispatch.

## 10-15 triage (operator ask on the dashboard)

Live: open, 0 comments, **assigned jkwak-work, milestone Q4 2026 (Fall)** (set 10-14). #11803 still open, head `97310dc612`.

**Scope is wider than the body.** Plain `Load<T>` at a literal multiple of the natural stride is wrong for any 3-vector:
`float3`@12/48, `int3`@24, `half3`@6 (std430 stride 8). Struct members too: `struct V{float3 p; float3 n;}` `Load<V>(0)`/`Store<V>(0)`
put `n` at byte 16. `-fvk-use-scalar-layout` (ArrayStride 12) is correct, so it's a workaround. HLSL is correct.

**Regression split** (release binaries in `/tmp/old/`): plain `Load<float3>(12)` is wrong back to v2025.12 (long-standing). The struct-member
case was correct through v2026.10 (per-float, index 3) and wrong from v2026.11. The only legalizer commits in that range are #11431
and **#11430 (`85c65f862c`, jkwak-work, "Fix unaligned byte-address descriptor loads")**. By code trace #11430 is the cause:
the old `isAligned(emitOffsetAddIfNeeded(base, imm), …)` saw a non-literal add and scalarized, while the new one computes `(0+12)%12==0` → `emitSimpleLoad`.
Not bisected by build. The timestamped `gate` controls above refer to the deleted recurring task.

**10-15 11:51Z:** slang-triager confirmed every claim, including a build bisect of `85c65f862c^` vs `85c65f862c` (the struct case flips). Posted https://github.com/shader-slang/slang/issues/13603#issuecomment-6191375234, labels `regression`+`reproduced`, Type Bug. It also noted that `Load<V>(24).p` (a literal combined offset) was already broken on v2026.10, which is why only `base 0 + imm` cases regressed. Triager state: its `memory/issues/13603.md`; bisect worktree `wt-13603-bisect` is kept until close.

## 10-20 re-chase r1

Still quiet: open, only our 10-15 triage comment, no linked PR, no legalizer commits since 10-13, #11803 still open at
`97310dc612`. No mention of #13603 on the dashboard after the 10-15 11:52Z report (rows 503192/503198). Main sent
orchestrator-dashboard a 5-bullet asking the operator to choose: (a) dispatch slang-fixer for a separate PR (not inside
#11803), (b) wait for jkwak-work, (c) ping jkwak-work on the issue first. No coworker was dispatched. One-shot
`rechase-slang-13603-r2-c9ac` is set for 10-27 15:00Z (R11 slot 2/3).

## 10-27 re-chase r2

Still open, only our triage comment, no linked PR, no non-bot comment. No operator answer to the r1 ask (dashboard row 506320)
in dashboard rows 503198–508398. **#11803 MERGED 10-22 (`b85938e1c2`)**, so the "not inside #11803" constraint is moot; legalizer
commits since: #13647, #11803, #13735 — none touches the natural-stride divide in `emitSimpleLoad`/`emitSimpleStore`.
Re-verified on a fresh Release build of master `9a4817c881` (worktree `slang/wt-13603-r2`, kept; note that `slangc` alone is
not enough for SPIR-V, it also needs the `slang-glslang` target): `Load<float3>(12)` → `%uint_1` on ArrayStride 16 (bytes 16–27), store@36 → `%uint_3`;
`Load<V>(0).n` same; GLSL same; `-fvk-use-scalar-layout` correct. Open PRs in the file (#13863, #13852, #13815, #13776) are
all WGSL/Metal. Sent orchestrator-dashboard the 5-bullet restating (a)/(b)/(c). Nothing dispatched. Scheduled the final
re-chase `rechase-slang-13603-r3-6781` for 11-03 15:00Z. If still unchanged, PARK (no r4).
