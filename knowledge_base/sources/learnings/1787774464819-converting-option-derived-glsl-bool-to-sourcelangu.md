---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787773809084-ckr420
written_at: 2026-08-26T20:01:04.819Z
---

# Converting option-derived GLSL bool to SourceLanguage: prefer-TU-first drops the -allow-glsl case

When refactoring the front-end's option-derived `bool isGLSLInput` (slang-check-modifier.cpp:1957-1961, in `SemanticsVisitor::checkModifier` → `isModifierAllowedOnDecl` at :1675) into a `SourceLanguage` value, **do NOT resolve it as `getTranslationUnitRequest() ? tu->sourceLanguage : GLSLModuleModifier-fallback`.** That ternary is a latent regression.

**Why:** today `isGLSLInput = AllowGLSL(option) || moduleDecl.has<GLSLModuleModifier>`. The parser (slang-parser.cpp:9984-9986) sets `allowGLSLInput = AllowGLSL || sourceLanguage==GLSL` and at :6349-6361 stamps a `GLSLModuleModifier` on the module whenever `allowGLSLInput`. But for a plain `.slang` file compiled with `-allow-glsl`, `TranslationUnitRequest::sourceLanguage` stays `SourceLanguage::Slang` (only `.glsl`/`#version` input sets it to GLSL). So the "prefer TU sourceLanguage first" ternary yields `Slang` → `isGLSLInput=false`, silently dropping BOTH the option and the stamped modifier — where today it is `true`. The `isGLSLInput` arms at :1723/:1733 genuinely *widen* accepted modifier placements (extra StructDecl/GLSLInterfaceBlockDecl), so the flip *rejects* supported code.

**Correct behavior-preserving derivation:** `(AllowGLSL || moduleDecl.has<GLSLModuleModifier>() || (tu && tu->sourceLanguage==GLSL)) ? SourceLanguage::GLSL : (tu ? tu->sourceLanguage : SourceLanguage::Unknown)`. Guard test: `tests/diagnostics/volatile.slang` has a 5-row `-std`×`-allow-glsl` matrix; the two `-allow-glsl` rows must stay `no-diag`.

**General trap:** "GLSL permitted here" (AllowGLSL compatibility mode) ≠ "the source language is GLSL". Collapsing the two is a *behavior* decision for a maintainer, not a mechanical refactor. `m_translationUnitRequest` is also nullptr on reflection/standalone-type-check/linkable/language-server paths, so the `GLSLModuleModifier` fallback is load-bearing and must be kept. Context: slang#12774, gated on PR #12596.
