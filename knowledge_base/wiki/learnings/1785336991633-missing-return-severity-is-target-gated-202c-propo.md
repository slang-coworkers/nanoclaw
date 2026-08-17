---
title: "Missing-return severity is target-gated; 202c proposal moves it to language-version gating"
type: learning
topic: agent-ops
source: learnings/1785336991633-missing-return-severity-is-target-gated-202c-propo.md
---

# Missing-return severity is target-gated; 202c proposal moves it to language-version gating

shader-slang/slang#12264 (skiminki-nv, MEMBER) proposes making a missing return in a non-void function an UNCONDITIONAL error (E41009) on ALL targets for language version 202c, gating on `module->languageVersion` instead of the target.

**How missing-return diagnostics work today (verified @ HEAD 1eeb3b29d):**
- `doesTargetAllowMissingReturns(CodeGenTarget)` at `source/slang/slang-ir-missing-return.cpp:18-26`: returns false for `isKhronosTarget(target) || isWGPUTarget(target)` (SPIR-V/GLSL/WGSL → hard error E41009), true otherwise (HLSL/DXIL/Metal/CUDA/CPP → warning E41010 only). So severity is a property of the *backend*, not the language — a portability trap.
- Diagnostics: `MissingReturnError` = E41009 at `slang-diagnostics.lua:4896`; `MissingReturn` = E41010 at `:4903`.
- The check runs TWICE by design (NOT a duplicate — documented in slang-ir-missing-return.h): (1) lowering-time `slang-lower-to-ir.cpp:15675` with `CodeGenTarget::None`, `diagnoseWarning=true` → E41010 warning; (2) link/emit-time `slang-emit.cpp:1554` with the real target, `diagnoseWarning=false` → E41009 error on strict targets. Both gated by `shouldRunNonEssentialValidation()`.
- Empirically confirmed: spirv/glsl/wgsl → warning+error exit255; hlsl/metal/cuda → warning-only exit0.

**Key triage facts:**
- The module's language version IS in scope at the lowering-time call — `slang-lower-to-ir.cpp:15682` already reads `getModuleDecl()->languageVersion` 7 lines below. Version-gating idiom `module->languageVersion >= SLANG_LANGUAGE_VERSION_2026` is well-established (slang-parser.cpp:6370, slang-check-decl.cpp:21293). Frontend helper `isSlang2026OrLater(SemanticsVisitor*)` serves the front end only; an IR pass must read `module->languageVersion` directly.
- **#12179 is the hard prerequisite and is an OPEN PR (not merged).** `SLANG_LANGUAGE_VERSION_202C`, `isSlang202cOrLater()`, and `-std 202c`/`next` are ENTIRELY ABSENT from master — a fix cannot compile against master until it lands. Always verify a "depends on #N" claim by checking whether the symbols it adds exist on master, not just the issue/PR state.
- `slangi`/bytecode reports NOTHING today even though the lowering-time (target-agnostic) call should fire — open investigation item (shouldRunNonEssentialValidation off by default for slangi? diagnostic suppressed? path skipped?). Whoever owns the 202c rule must cover the bytecode path.
- Core-module audit needed before core moves to 202c: #10307 is a live example (hlsl.meta.slang HitObject.FromRayQuery already trips E41009 on SPIR-V).

**Routing:** PARK-at-triaged, no fixer dispatch (skiminki-nv MEMBER self-files+defers pattern + hard unmet dep + open design forks). Resume when #12179 merges AND maintainer says "make a PR".

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785336991633-missing-return-severity-is-target-gated-202c-propo.md`_
