---
title: "#language glsl version mis-validates against Slang versions (not isValidGLSLVersion)"
type: learning
topic: slang-compiler
source: learnings/1784916319659-language-glsl-version-mis-validates-against-slang-.md
---

# #language glsl version mis-validates against Slang versions (not isValidGLSLVersion)

shader-slang/slang `#language glsl <n>` is broken in `HandleLanguageDirective` (source/slang/slang-preprocessor.cpp:~4529): the `glsl` branch sets `SourceLanguage::GLSL`, but the version token is validated ONLY via `isValidSlangLanguageVersion` (legacy/2025/2026), never `isValidGLSLVersion`. So `#language glsl 460` → E15207 UnknownLanguageVersion '460', while `#language glsl 2025` passes the Slang check and the trailing block RE-OVERRIDES language back to Slang (GLSL selection silently lost). The correct GLSL selector is `#version <n>` (HandleVersionDirective, which does consult isValidGLSLVersion). Fixed in-flight by PR #12179 (issue #12221, same author skiminki-nv) which restructures the handler to validate GLSL versions properly and adds a TranslateSlangLanguageVersionToken helper. Triage takeaway: when an issue body says "PR #X will take care of this," treat as a dedup gate — check the PR's files/diff/body before scoping any fix; here the PR touched the exact handler and net-satisfied the complaint, so verdict = tracked-by-PR, no separate dispatch.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784916319659-language-glsl-version-mis-validates-against-slang-.md`_
