---
name: project_12181_debug_info_include_source_flag
description: "#12181 new CLI arg -debug-info-include-source — RE-OPENED, held for jkwak design call"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8867d2d3-8352-4103-bb95-c3d97312a6b4
---

# #12181 — Add CLI arg `-debug-info-include-source`

Maintainer **jkwak-work** (MEMBER) filed AND self-assigned; **no "make a PR" ask** → per no-autofixer-on-self-filed convention, **PARKED at triaged**, fixer NOT dispatched. Verdict posted as issue comment **5038880083**.

**Ask:** embed shader source *text* in SPIR-V independently of `-g` level. Empirically @HEAD cbabb7bde: `-g0` none · `-g1` filename+line only (the gap) · `-g2/-g3` full source. Also wants source at `-g0` when flag explicitly set.

**Classification:** feature/enhancement · low · P3 · SPIR-V debug-info emit + CLI options + public ABI. `pr: non-breaking` (append-only enum).

**Recommended solution (triager memo):** new orthogonal bool flag `CompilerOptionName::DebugInfoIncludeSource=157`, mirror `-separate-debug-info` pattern. KEY: "embed source?" decision is DUPLICATED across two level-keyed layers — producer `slang-lower-to-ir.cpp:15425-15436` (g0 = no IRDebugSource; g1 = empty content) AND consumer `slang-emit-spirv.cpp:2164`. Emit-only one-liner insufficient; must thread flag through BOTH. Open unknown: g0-with-flag spirv-val well-formedness (needs NonSemantic ext + minimal DebugCompilationUnit scaffolding absent at g0).

**Files:** include/slang.h:1239-1249 · source/slang/slang-options.cpp:950/4017 · source/slang/slang-lower-to-ir.cpp:15425 · source/slang/slang-emit-spirv.cpp:2164

**Cluster:** SPIR-V debug-info — [[project_12147_separate_debug_info_output_block]] (mirrors that flag pattern), [[project_12148...]]/DebugFunction CU, [[project_11682_g0_spirv_debug_info_scope_fork]] (-g0 scope).

## RE-OPEN (07-22) — jkwak design question, answered with spirv-asm receipts
jkwak commented (**5040455960**, real `@nv-slang-test` mention): does embedding source require `SPV_KHR_non_semantic_info`? If so, `-g0`+new-option should **error**.

Triager posted verified reply (**5040498822**):
- **YES as Slang emits today:** embedded source binds to module *only* via NonSemantic `DebugSource` (`%1 OpString "<src>"` → `OpExtInst … DebugSource`), needs `SPV_KHR_non_semantic_info`. Core `OpSource Slang 1` carries language+version only (emit site `slang-emit-spirv.cpp:12083`).
- **Broader than his -g0 framing:** `-g1` today emits ZERO extensions (core OpSource + OpLine), so the option pulls the ext into `-g1` too — property of *how we embed*, not the debug level.
- **Key correction:** SPIR-V spec gives core `OpSource` *optional* File+Source operands (+`OpSourceContinued`) → source CAN embed with no ext; Slang just doesn't wire that path. Ext dependency is an **implementation choice, not spec necessity.**
- **-g0 options (maintainer's call):** (a) **error** on -g0+option — cleanest but contradicts his original "embed at -g0" note (tension surfaced); (b) implicit NonSemantic scaffolding+ext at -g0 — avoid; (c) embed via core OpSource Source operand (no ext) — only way -g0 stays minimal AND source-carrying, larger change. **Recommended (a)** if OK reversing note, else (c).

**State:** chain OPEN, held for jkwak's option pick. Re-open trigger: he picks an option OR says "make a PR" → triager dispatches slang-fixer on canonical thread `gh-issue-shader-slang/slang-12181`, requests orch authorization then.
