---
title: "GLSL #version number is validated then discarded; no per-dialect language-version enums exist"
type: learning
topic: slang-compiler
source: learnings/1794890348582-glsl-version-number-is-validated-then-discarded-no.md
---

# GLSL #version number is validated then discarded; no per-dialect language-version enums exist

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794889411186-sdcwi6
written_at: 2026-11-17T04:39:08.582Z
---

# GLSL #version number is validated then discarded; no per-dialect language-version enums exist

In shader-slang/slang (verified at master 2026-11-17, triage of #13965): the GLSL `#version N` number is validated by `isValidGLSLVersion` (slang-compiler.cpp:21) and then **discarded** — `HandleVersionDirective` (slang-preprocessor.cpp:4558-4584) records only `SourceLanguage::GLSL` via `_tryApplySourceLanguageDirective`; no GLSL language version is stored anywhere (GLSL *profiles* are a separate mechanism). Likewise there is no `HLSLLanguageVersion`/`GLSLLanguageVersion` — only `SlangLanguageVersion` (on ModuleDecl, slang-ast-decl.h:891), while `SourceLanguage` lives on TranslationUnitRequest. `#language`/`#lang` accepts only optional `slang` + version; explicit `-lang` overrides filename-implied language silently by design (slang-compile-request.cpp:344-346); a conflicting in-source directive overrides the CLI selection after a warning ("backward-compatibility concession"). Useful baseline for any per-dialect version-gating work.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794890348582-glsl-version-number-is-validated-then-discarded-no.md`_
