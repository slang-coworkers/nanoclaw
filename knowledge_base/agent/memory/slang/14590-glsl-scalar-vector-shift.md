---
type: chain-record
description: GLSL emitter lacks scalar-splat legalization for scalar>>vector shifts; triaged, fixer chain running
---

# slang#14590: glslang rejects scalar >> int2 with -emit-spirv-via-glsl

**Issue:** https://github.com/shader-slang/slang/issues/14590 (filed 11-18 by jkwak-work, self-assigned; bug/P2 per triage).
`scalar >> int2(n)` keeps mixed-shape IR `Rsh(scalar, vector)` through the GLSL path; glslang rejects `int >> ivec2`.
Direct SPIR-V compiles. Reporter says `tests/wgsl/bitshifts.slang` carries a `glsl`-target exclusion naming this —
**does not match master** per triage (reporter likely on a WIP branch); flagged in the triage comment.

**Chain:** webhook → dispatched slang-triager 15:06Z on canonical thread `gh-issue-shader-slang/slang-14590`
(👀 posted; no prior chain, no fix PR, self-assignment ≠ stand-down). Triage 15:16Z: reproduced on master `4a1d62c5b`,
`reproduced` label + Bug type applied. Triager handed to slang-fixer; fixer session `sess-1795014982190-t1pqwp` live 15:16Z.
Sessions: triager `sess-1795014433893-wz2gp3`.

**Triage findings (fix direction):**
- Every target except GLSL unifies operand shapes pre-emit (SPIR-V splats at emit; CPU/CUDA via simplify-for-emit; Metal/WGSL
  via shared `legalizeBinaryOp`). GLSL path has no legalization; slang-emit-clike.cpp:2719 emits verbatim.
- Recommended approach A1: GLSL IR legalization reuses the shift-aware scalar-splat helper
  `legalizeScalarOperandsToMatchComposite` (slang-ir-legalize-binary-operator.cpp:64-99) via a hook in the Khronos legalize
  branch (slang-emit.cpp:2467-2492 pattern). Rejected: B emitter-side constructor (violates fix-at-IR-layer), C widening the
  CPU/CUDA `unifyBinaryExprOperands` gate (blast radius).
- Probe: embedded glslang accepts `ivec2>>uvec2` — only shape splat needed; WGSL's unsigned-shift rule must NOT leak into GLSL.
- CI gap: slang-test's `emitSPIRVDirectly` defaults true, so bitshifts tests only exercise direct SPIR-V.

**State (11-18 16:20Z):** fix chain open — **draft PR #14597** ("Splat the scalar operand of a shift for GLSL emission")
by nv-slang-bot, head `4c1307f2c61e6f3a82ccd4d903f3dd80fb5f6f4c`, opened 16:16Z on fix/issue-14590 → master.
`report_pr_created` verified (pr-mappings row → fixer sess-1795014982190-t1pqwp); explain-diff-html comment 6984453125
posted at head. P2, non-regression → no per-PR undraft ask; ready-flip goes on the weekly list once review completes.
Awaiting review/CI webhooks on the canonical thread; fix should cover the via-glsl gap with a `-emit-spirv-via-glsl` test leg.

**Verification point closed (16:4xZ):** triager asked whether the `target == CodeGenTarget::GLSL` gate misses the repro
(`-target spirv -emit-spirv-via-glsl`). Code trace: no — via-glsl routes through `emitWithDownstreamForEntryPoints`
(slang-code-gen.cpp:1177→385), where `_getDefaultSourceForTarget(SPIRV)` returns GLSL (:274) and the derived
`CodeGenContext(this, GLSL, ...)` (:534) re-enters `linkAndOptimizeIR` with targetFormat=GLSL (slang-emit.cpp:3223) →
gate fires. Direct SPIR-V stays SPIRV → gate silent (byte-identical holds). PR test leg 2 uses the exact repro command
and passes. Resolution sent to the triager on the peer edge (msg 33).

**[Fix Report] received 17:41Z (final):** head advanced to `272b43619` (4 commits: repro test → fix → doc precision → test
pinning; +133/−2, 6 files). Review TERMINAL on our side: APPROVE_WITH_NITS from 3 reviewers (correctness 0 bugs/2 gaps,
Devin 0 bugs/2 flags, clarity 4 candidates), all nits applied with no second round; codex PLAN/CODE/OUTPUT_REVIEW approve.
Tests: repro 2/2 (failed on master), glsl 380/380, cross-compile 105/105, glsl-intrinsic 250/250, wgsl bitshifts 1/1;
direct spirv-asm byte-identical. I verified live: PR head 272b43619 draft, 4 commits, combined CI status success.
Forwarded the report to the triager (msg 41) — it was waiting on it for its [Triage Resolution]; session wakes to process.
Note: my relay tripped the codex-critique GATE AUDIT (gate skipped — send succeeded); inline receipts (code trace, live
PR/CI state) covered the load-bearing claims; run codex-critique before any future [Fix Report]-shaped relay this session.

**Chain TERMINAL (our side) 17:42Z:** triager's [Triage Resolution] delivered — issue trail refreshed in place (bot comment
6984471146 patched 17:39:53Z, verified live: "Next-action: Human review of draft PR; blocker: none"). Note: comment still
says CI in priority-yield queue — my combined-status check showed success at 272b43619, but the fixer/babysitter own CI
and follow it by webhook; not chased. All stages complete: webhook→triage (15:16)→fixer (draft PR #14597 @ 272b43619,
review nits applied, codex approves)→[Fix Report] (17:41)→[Triage Resolution] (17:42). **Ready-flip pending on the weekly
undraft list** (P2, no fast-flip ask). Resume ONLY on PR #14597 webhook (human review comment / ready-flip / merge / CI
event). No further nudges — the babysitter + supervisor tick cover CI staleness.

(End of file)
