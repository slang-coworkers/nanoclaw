---
name: project-12221-language-glsl-version-dedup
description: "slang#12221 remove `#language glsl <version>` — DEDUP, tracked by author's PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: c9b92e34-8c0d-4f4e-b91a-97c39bce4558
---

# slang#12221 — Remove `#language glsl <version>` support

Filed + self-assigned by **skiminki-nv** (MEMBER) 2026-07-24, label `Dev Opened`. Issue Type "Language Maturity" (maintainer-set).

**Bug:** `HandleLanguageDirective` (source/slang/slang-preprocessor.cpp:4529, master 5281ccc66) sets `SourceLanguage::GLSL` for the `glsl` branch but validates the version token via `isValidSlangLanguageVersion` (Slang-only: LEGACY/2025/2026), never `isValidGLSLVersion`. So `#language glsl 460` → `error[E15207] unknown language version '460'`; `#language glsl 2025` silently re-overrides back to Slang 2025 (GLSL lost). `#version 460` (`HandleVersionDirective`, :4501) is the correct GLSL selector.

**Verdict (triaged 07-24): DEDUP — reproduced → tracked by in-flight PR #12179.**
- REPRODUCED @ top-of-tree (slangc 2026.13.1-50-g3649fb982). `reproduced` label applied.
- **PR #12179** (OPEN draft, SAME author, `Fixes #12045`, branch `12045-deprecate-legacy-struct0`) restructures exactly this handler: parses language first, validates GLSL via `isValidGLSLVersion`, keeps GLSL (no Slang re-override), adds `TranslateSlangLanguageVersionToken` + tests in `tests/language-feature/lang-version.slang`. Note: **fixes** (correctly routes GLSL versions) rather than **removes** — superset of the issue's literal ask.
- Issue body verbatim: *"After updated, PR #12179 will take care of this."*
- **No fixer dispatched** — competing PR would conflict with author's own self-assigned work.
- Verdict posted: issue #12221 comment 5072953748.
- classification: bug · low · P3 · frontend/preprocessor. No `regression` (longstanding).

**Chain state:** CLOSED at triaged/dedup. Resolves when #12179 lands (closes #12045, not #12221 directly — watch that #12179 or author closes #12221 too). Re-open only on fresh substantive human comment.
