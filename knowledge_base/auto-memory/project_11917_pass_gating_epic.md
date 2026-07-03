---
name: project_11917_pass_gating_epic
description: shader-slang/slang
metadata: 
  node_type: memory
  type: project
  originSessionId: d426803e-6b4c-4725-a21a-7ca38bb18994
---

**#11917** "Avoid running backend IR passes when they cannot apply" — compile-time perf epic on `RequiredLoweringPassSet` / `linkAndOptimizeIR` (`source/slang/slang-emit.cpp`). ~55 of ~80 backend passes run unconditionally (full-module walks) even when their IR feature is absent. Author pdeayton-nv.

**Framing (triager, HEAD-verified):** incremental epic, NOT a one-shot. Batch-gating all ~55 is a miscompile hazard — a stale-FALSE flag (feature present, flag unset) skips a needed pass. Autodiff (#11474/open PR #11476) is the canonical trap. Approach **A** (per-pass gating, one profiled pass at a time, first PRs restricted to passes where stale-FALSE is structurally impossible) chosen over B (fix staleness/rescan) and C (shared opcode-presence index).

**Slice #1 — SHIPPED.** Draft PR #11920 gated `lowerAppendConsumeStructuredBuffers` behind new `RequiredLoweringPassSet::appendConsumeStructuredBuffer` (front-end-only opcode, never synthesized late → stale-FALSE structurally impossible). MERGED to master by @jkwak-work 2026-07-03T02:27:27Z (mergeCommit `96003b0d85`, `Addresses` = non-closing → **#11917 stays OPEN** as the epic tracker). Guardrail clean end-to-end: bot never readied/merged — jkwak-work did both himself. Tests: 2 SIMPLE regressions × glsl+spirv-asm (present+absent); revert-drill byte-identical. Triage verdict comment 4870469839 kept current in place.

**Pass #2 — PENDING operator authorization.** jkwak signaled this first pass had modest *standalone* perf value (cheap global-insts scan); prioritize the next pass by **profiled compile-time cost**. Do NOT auto-dispatch the fixer — needs a fresh task/operator go-ahead. Fixer's plan persists at `/workspace/agent/reports/slang-11917.md` (fixer's own FS, opaque to Main). Approach A is the validated template. Reopen chain only on substantive human comment on #11917 or operator go-ahead for pass #2. See [[feedback_let_fixer_own_single_session]], [[feedback_drafts_only_guardrail]].
