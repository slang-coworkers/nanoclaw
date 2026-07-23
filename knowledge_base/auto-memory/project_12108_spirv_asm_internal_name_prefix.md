---
name: project_12108_spirv_asm_internal_name_prefix
description: "#12108 prefix internal spirv_asm regs __ + parse-time assert — draft PR #12190"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0043030e-d9e3-4830-b491-b330084a69b3
---

**#12108** (shader-slang/slang) — prefix ALL internal `spirv_asm` result registers `%foo`→`%__foo` in `*.meta.slang` so their auto-emitted `OpName`s read as compiler-internal, + a parse-time `SLANG_ASSERT` catching future un-prefixed internal names at build. Follow-up to PR #12053 (fixed #12002, prefixed only `%__sampled`). Scope/solution set by **@jkwak-work**; motivated by @maxime-modulopi.

**jkwak-work asked @nv-slang-bot to make the PR** (twice: cmt 5008499085 07-17, re-ask 5051765598 07-22). Routed to slang-fixer on canonical thread `gh-issue-shader-slang/slang-12108`.

**Draft PR #12190** (07-22 22:38Z), branch `fix/issue-12108`. 5 files +352/−314: renamed 344 regs in hlsl.meta.slang + 69 in glsl.meta.slang + generated GetDimensions blocks in `slang-core-module-textures.cpp` (codex CODE_REVIEW caught these programmatic regs `%vecSize %_width %_sampleCount %_levelCount %c_*` — assert would've fired, prefixed too). Assert wired at `%id` chokepoint gated by new `ParserOptions::isCoreModule`. Core-module debug build self-checks all ~626 sites.

**OUT OF SCOPE** (do not touch): emitter auto-`OpName` loop `slang-emit-spirv.cpp:11616-11617` (intentional tested feature, `opname.slang`); debug-info-level gating of OpNames (orthogonal, @maxime-modulopi #12053).

Tests: new `tests/spirv/internal-spirv-asm-opname-prefix.slang` PASS; opname.slang + texture-sample-internal-opname.slang PASS; tests/spirv 546/546, glsl-intrinsic 246/246. codex CODE/PLAN/OUTPUT approved.

**State:** draft-held per [[feedback_drafts_only_guardrail]] (creation authorized, NOT ready-flip/merge). 5-bullet posted on issue #12108 (cmt 5052245458). fixer dispatched slang-reviewer (Reviewer A) on canonical thread. CI = cosmetic priority-yield red (draft manual-dispatch, [[project_bot_pr_priority_yield_red_run]]). **Await Reviewer A + maintainer ready-flip.** Verify fixer called report_pr_created ([[feedback_verify_report_pr_created]]).
