---
name: project-12240-switch-64bit-condition-spirv-truncated-opswitch
description: "shader-slang/slang#12240 — 64-bit switch condition emits truncated OpSwitch (invalid SPIR-V); triaged+held pending skiminki authorization"
metadata: 
  node_type: memory
  type: project
  originSessionId: 365a67a9-06c1-4717-9ac6-fe5d2f88e7d1
---

# #12240 — 64-bit switch condition → truncated OpSwitch (invalid SPIR-V)

**Repo:** shader-slang/slang · **Filed:** 2026-07-27 by skiminki-nv (`Dev Opened`) · **Class:** bug / P2 / target-emit (SPIR-V)

**Symptom:** switch on a 64-bit integer selector (`uint64_t c; switch(c){ case 0x123456789ABCDEFU: ... }`) emits an OpSwitch whose case literals are a single 32-bit word regardless of selector width → SPIR-V validation fails: `End of input reached while decoding OpSwitch ... expected more operands after 5 words` (E99999). Upper 32 bits of the case value also dropped.

**Root cause (emit-side only):** `slang-emit-spirv.cpp:5436` — `kIROp_Switch` in `emitLocalInst` does `emitOperand((SpvWord)intLit->getValue())`, casting to one 32-bit word with no width query. IR is correctly typed (i64 case values); purely the SPIR-V emitter. REPRODUCED @HEAD `70462843c` (Debug slangc + `SLANG_RUN_SPIRV_VALIDATION=1`, no GPU). 32-bit-selector control compiles clean.

**Dedup:** DISTINCT root from siblings — do NOT merge, one fix does not cover multiple:
- [[project-12237-bool-switch-spirv-assert]] — bool / `processSwitch()` `IRBoolLit` normalization
- [[project-12238-float-switch-condition-invalid-spirv]] — float / `visitSwitchStmt` `TODO(tfoley)`
- #12236 & #9999 — missing-diag (`lowerSwitchCases()`)

**Fix (staged, Approach A, NOT applied):** mirror `emitIntConstant` from64/from32 via `getIntTypeInfo` at the OpSwitch literal site so case literals are emitted at the selector's bit-width; add spirv-validation regression test. Fixer briefing staged in triager memo.

**Status:** `reproduced` label applied; verdict posted https://github.com/shader-slang/slang/issues/12240#issuecomment-5095105992 — **HELD without a PR** per skiminki-nv self-defer pattern (self-files + self-defers; fix authorized ONLY on explicit "make a PR"). Release to slang-fixer on that signal. Full triager briefing (root cause, repro, 2 candidate approaches + recommendation, dedup) staged for fixer as `triage-12240.md`.
