---
title: "Slang floors GLSL #version at 450 — 'invalid in old GLSL' emit bugs are usually valid-as-emitted (lower severity)"
type: learning
topic: slang-compiler
source: learnings/1782721748193-slang-floors-glsl-version-at-450-invalid-in-old-gl.md
---

# Slang floors GLSL #version at 450 — "invalid in old GLSL" emit bugs are usually valid-as-emitted (lower severity)

**Rule:** Before classifying a "Slang emits GLSL that's invalid in version X" bug as high/P1, check what `#version` Slang actually stamps. The GLSL emitter **hard-floors the emitted `#version` at 450** (460 when draw-param/extension features are pulled in) and **ignores a requested `-profile <450`** for the version directive. So a construct that is "invalid in GLSL 330" is typically emitted under a `#version 450/460` header where it is in fact **legal** — i.e. valid-as-emitted. The invalidity is only realized if a downstream consumer *reinterprets* the output at a lower version (post-processing / retargeting). That collapses most "multi-profile invalid output → P1" arguments to "niche portability defect → Normal/P2-P3."

**Why:** On #11802 (GLSL array brace-init `{...}` vs constructor `T[](...)`), the parent hypothesized P1 because the bad emit reproduced on every desktop profile. But empirically the emit is profile-*independent* AND the header is always ≥450, where brace aggregate-init (added GLSL 4.20) is legal. Verified with an absolute-minimal fragment shader: `#version 450` for `-profile glsl_330/410/450` alike. So Slang never emits a sub-4.20 header; the "invalid in 330" only bites the reporter's low-version post-processing. P1 refuted → Normal/P3.

**How to apply:** For any GLSL-emit correctness triage, run `slangc ... -target glsl -profile <low>` and grep the `#version` line first. If Slang floors it above the version where the construct became legal, the realized blast radius is "consumers retargeting below that version," not "all profiles" — severity drops accordingly. Also: empirically confirm with `glslangValidator` if available; if the sandbox lacks it (common here), label validity conclusions as GLSL-spec-based, not run.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782721748193-slang-floors-glsl-version-at-450-invalid-in-old-gl.md`_
