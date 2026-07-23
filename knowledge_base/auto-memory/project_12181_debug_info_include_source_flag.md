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

## DECISION (07-22, comment 5048509806) — jkwak picked hybrid (a)+(c); FIXER DISPATCH AUTHORIZED
jkwak's exact spec:
1. `-g0` + `-debug-info-include-source` → **error** (conflicting request). [= option (a)]
2. `-gX` X≥2 → keep current behavior (source via NonSemantic); new option **effectively ignored** (source already emitted).
3. `-g1` + option → emit source with **core `OpSource` syntax** so it does NOT rely on NonSemantic, even when final SPIR-V may still use NonSemantic elsewhere. [= option (c), scoped to -g1]

**Orch authorized fixer dispatch** (concrete maintainer spec = sanctioned go-ahead). Triager dispatches slang-fixer on canonical thread. Implementation notes (from triager memo): new flag `CompilerOptionName::DebugInfoIncludeSource=157` (append-only, non-breaking); thread through BOTH producer `slang-lower-to-ir.cpp:15425` + consumer `slang-emit-spirv.cpp:2164`; the -g1 case needs the currently-unwired **core OpSource File+Source operand path** (+`OpSourceContinued`), NOT the NonSemantic DebugSource path. Core OpSource emit site `slang-emit-spirv.cpp:12083`.

**Guardrails:** drafts-only (fixer produces DRAFT PR, holds; no ready-flip/merge without operator gate); fixer MUST call `report_pr_created`; PR desc carries 5-bullet + `Fixes #12181`; draft-held ⇒ triager/fixer ALSO posts 5-bullet on issue (draft-held PR requires issue comment).

**State:** OPEN, fixer dispatch in flight.

## 07-22 status-share + fixer-idle blocker
- jkwak asked for update on issue (comment 5052591363, `@nv-slang-bot`). Triager posted honest in-flight status (**5052618172**): design locked to 3-part spec; fix implemented across 4 layers (flag 157, -g0 error, producer content-carry, consumer core-OpSource reusing DebugSource OpString); building/validating locally; 3 behavior checks pending; draft PR to follow. Verified NO PR up yet (gh search empty) → did NOT overpromise.
- **False-blocker RESOLVED:** fixer looked idle (build-shell reaped w/o BUILD_EXIT echo) but session was alive + progressing. Orch decision was nudge-not-restart; triager confirmed healthy before any restart. **DO NOT restart** (would lose built worktree).
- **Build FINISHED 1182/1182; all 3 behaviors verified on real binary:** (1) -g0+opt → error **E57007**; (2) -g1+opt → core `OpSource` w/ embedded source, File-id reuses filename OpString (no dup), zero NonSemantic dep for source; (3) plain -g1 byte-unchanged, -g2 keeps NonSemantic.
- **Remaining pre-PR:** slang-test + FileCheck self-match immunity + formatting + codex CODE_REVIEW → draft PR + report_pr_created. Triager edits status comment 5052618172 in place when PR# lands, forwards [Triage Resolution]. Status comment accurate; no GitHub re-post until draft PR up.
