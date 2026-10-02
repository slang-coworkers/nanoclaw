---
name: project_11933_fp_precise_nocontraction
description: SHIPPED — #11933 -fp-mode precise no-op on direct SPIR-V; PR #11935 MERGED to master (33f9ed0ce); issue CLOSED 2026-07-08; per-decl follow-up now tracked by #13324
metadata: 
  node_type: memory
  type: project
  originSessionId: b2f7a26c-5f5c-4413-b07d-e4f6ee650c54
---

**#11933** — `-fp-mode precise` is a no-op on the direct SPIR-V emit path: no `NoContraction` emitted, so `precise.spv` == `fast.spv` == `default.spv` and Vulkan drivers stay free to contract/reorder float math. Reproduced at HEAD `f4975a7f8` (GPU-free, md5 match, zero decoration-42). Bug / medium / P2 / target-emit (SPIR-V), NOT a regression (repros on v2026.12.2 + 2026.7.1).

**Root cause:** direct SPIR-V emitter never emits `NoContraction` (string absent from all Slang source). Global `-fp-mode` reaches only downstream compilers (`slang-code-gen.cpp:820-829` — why `-emit-spirv-via-glsl` works); `precise` modifier's `IRPreciseDecoration` dropped by `emitDecoration()`'s `default: break;` at `slang-emit-spirv.cpp:6003`. Correct fix decorates the ARITH ops (OpFAdd/OpFMul), NOT the decl — spirv-val rejects `NoContraction` on `OpVariable`/`OpFunctionParameter`; matches glslang/DXC.

**Fix:** decorates emitted FP arithmetic with per-instruction `NoContraction` when effective mode==Precise (opcode-gated, spirv-val-safe; matrix rows decorated, reassembly not). New regression test `tests/spirv/fp-mode-precise-nocontraction.slang`; tests/spirv 493/493; `SLANG_RUN_SPIRV_VALIDATION=1` OK. jkwak design Qs all resolved (per-inst `NoContraction`/Shader-cap correct; `ContractionOff`=Kernel/OpenCL-only; `FPFastMathDefault`=future home for `-fp-mode fast`).

**State (07-07) — SHIPPED (terminal):** PR **#11935** (`fix/issue-11933`) **MERGED** by maintainer **jkwak-work**, merge commit `33f9ed0ce` on `master` (2026-07-07T21:18:07Z) — verified live on origin/master, landed test present. Non-draft flip + APPROVE + merge all maintainer-driven (bot did NOT flip; drafts-only gate NOT breached, [[feedback_drafts_only_guardrail]]). Internal Reviewer A/B/C verdict never arrived — moot post-merge; maintainer approval authoritative. Verdict comment 4873884190 refreshed to merged state (edit-if-self; earlier removed the harmful "add `kIROp_PreciseDecoration:` case" line — spirv-val rejects `NoContraction` on OpVariable/OpFunctionParameter). **Issue #11933 intentionally left OPEN** (non-closing `Related to`) to track the per-declaration `precise` modifier follow-up (glslang-style backward propagation — separate larger change); a maintainer may close it or keep it as the tracker. Chain closed terminal. Re-engage ONLY on a fresh substantive human comment or the per-decl follow-up; do NOT double-dispatch.

**2026-09-29 — overlap:** tangent-vector filed **#13324** ("Fix (and start regression-testing) handling of the precise keyword") — the per-decl `precise` backward-propagation work this issue was left open for. Dispatched to slang-triager on `gh-issue-shader-slang/slang-13324`; that chain owns the per-decl work now. Don't open a second chain from #11933.
**Correction (verified 2026-09-29 via gh):** #11933 was **closed 2026-07-08T13:47Z** (jkwak-work). The "left OPEN" state above is stale. #13324 was triaged 2026-09-29 as bug/medium/P2 (umbrella issue, not a dup). Its triage reply is cmt 5896239444. It is held for a maintainer to choose the call-boundary semantics: DXC→DXIL marks inlined callee math, glslang/DXC→SPIR-V don't. Linked: #13287 (closed, fixed by #13290), #13292, #12160.
**2026-09-29 22:38Z:** #13324 reassigned from tangent-vector to jkwak-work (verified via issue events). jkwak-work now owns the call-boundary decision; re-chase task `rechase-13324-precise-se-f45d`.
**2026-10-01:** jkwak-work proposed modelling `precise` like `atomic`, as an explicit generic struct `precise<T : __BuiltinFloatType>` with synthesized functions so HLSL code keeps working. Comment 5936287933. He asked for our thoughts, said "do not make a PR with my idea", and is still discussing it with tangent-vector. Sent to slang-triager as an opinion-only reply; the fixer stays held.
