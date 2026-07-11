---
name: project_12048_enum_to_int_cast_infllight
description: IN-FLIGHT
metadata: 
  node_type: memory
  type: project
  originSessionId: cfcf4a4e-5244-42d9-83b6-81819372a1ae
---

IN-FLIGHT — shader-slang/slang#12048 "Enumeration to integer cast is broken" (skiminki-nv, Dev Opened).

**Confirmed root cause (triager, local build + DeepWiki):** `calcRequiredLoweringPassSet` (slang-emit.cpp:436-437) flags the `enumType` lowering pass ONLY on `kIROp_EnumType`, never on enum-*cast* opcodes. When an enum-typed local holds a compile-time const (`XYZ xyz = XYZ.One`), SSA promotion + const-folding delete the local AND the last `IREnumType`, stranding a degenerate `CastEnumToInt(1:UInt)`. Flag stays false → `lowerEnumType` (:1276-1277) skipped → cast survives to code emit → `E99999 unexpected IR opcode`.

**Scope:** all 7 targets (target-agnostic pre-scan defect). Discriminator = enum-typed local var holding a const; direct `(uint)XYZ.One` and runtime `(XYZ)tid.x` both work. bug / high / P2 / IR back-end pass gating. NOT a dup of #7908 or #12046 cluster.

**Fix A (recommended):** add `CastEnumToInt`/`CastIntToEnum`/`EnumCast` (+Constexpr variants) to the switch so `enumType` flags on any surviving enum op — mirrors `taggedUnion` precedent (:561-568). B (SCCP fold) + C (emitter patch) rejected as symptom/consumer-side.

**FIXED — draft PR #12050** (07-10). https://github.com/shader-slang/slang/pull/12050 — OPEN, isDraft=true, branch fix/issue-12048, head 576c5a9305, `Closes #12048`, `pr: non-breaking`. Fixer narrowed Approach A: EXCLUDED the `Constexpr*` cast variants (no case in `lowerEnumType::processInst`; SCCP-folded) to avoid a false-coverage gate — good tightening. Tests: revert-drill (un-patched → HLSL+GLSL direct-emit FAIL E99999; patched → all 4 pass); new `tests/language-feature/enums/enum-to-int-cast-local.slang` (SIMPLE hlsl+glsl + CPU COMPARE_COMPUTE); 37/37 enums green; SPIR-V validation passes; codex PLAN/CODE/OUTPUT all-approve. Triager verified all artifacts vs live GitHub. Issue footprint: fixer posted issuecomment-4937856675 (draft-PR trail on #12048) ✓.

**Draft CI red = cosmetic** — `workflow_dispatch` run 29111014977: only `wait-for-human-priority`+`check-ci` "failed", all build/test SKIPPED. Matches [[project_bot_pr_priority_yield_red_run]]. Not a functional blocker.

**TERMINAL (bot-state) 07-10 — PEER-REVIEWED ✅ APPROVE, awaiting operator ready-flip.** `report_pr_created(shader-slang/slang, 12050)` CONFIRMED (host: "#12050 mapped to this session" — no orphan risk) ✓. Bot peer review (slang-reviewer, read real source @ then-head 576c5a9305): single round, APPROVE, 0 critical/high. Both focus points confirmed: (a) opcode set COMPLETE — {CastEnumToInt, CastIntToEnum, EnumCast} == exactly what `lowerEnumType::processInst` handles; any *live* enum value keeps its IREnumType alive so the pre-existing `kIROp_EnumType` arm fires — #12048's folded-away-type-with-residual-cast is the only residual case, precisely what the PR adds. (b) `Constexpr*` exclusion SAFE — those arise only in const IntVal contexts (emitConstexprCast←visitTypeCastIntVal), never runtime, no `lowerEnumType` case; reviewer ENDORSED rejecting triage's "+for completeness." 2 advisory non-blocking: (1) comment/PR-body SCCP wording imprecise → FIXED (reworded to IntVal-provenance); (2) compile-only CastIntToEnum/EnumCast leg → DECLINED w/ IR-dump probe (int→enum→int fully folds, no residual cast — fold-away leg can't be built non-vacuously). PR amended to head 4c507cb94c (comment-only, byte-identical logic), verified live still isDraft=true, `Closes #12048`, `pr: non-breaking`. codex CODE_REVIEW re-approved amended diff; regression 4/4 green.

**Next human action = flip #12050 ready → CODEOWNERS @shader-slang/dev → merge.** DRAFT by design; ready-flip + merge operator-gated [[feedback_github_writes_operator_authorized]] [[feedback_drafts_only_guardrail]]. Chain complete on bot side; PR follow-up (CODEOWNERS review, CI) webhook-driven to fixer's session. GitHub footprint: triage verdict (nv-slang-bot 4937328143) + draft-PR trail (4937856675) on #12048. No operator ping — standing ready-flip gate, supervisor digest covers aggregate.
