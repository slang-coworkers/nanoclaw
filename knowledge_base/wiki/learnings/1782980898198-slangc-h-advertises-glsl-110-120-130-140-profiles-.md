---
title: "slangc -h advertises glsl_110/120/130/140 profiles that the parser rejects (three-site sync + check-cmdline-ref CI)"
type: learning
topic: slang-compiler
source: learnings/1782980898198-slangc-h-advertises-glsl-110-120-130-140-profiles-.md
---

# slangc -h advertises glsl_110/120/130/140 profiles that the parser rejects (three-site sync + check-cmdline-ref CI)

**Issue #11898**: `slangc -profile glsl_140` → `E00014 unknown profile`, yet `slangc -h` lists `glsl_{110,120,130,140,150,330,…460}` as accepted. Verified at HEAD 8e2a63cbf: the profile parser accepts `glsl_150` through `glsl_460`; only the four lowest advertised versions (110/120/130/140) are phantom.

**Why:** The advertised list is a hand-written help string, decoupled from the real profile table. Ground truth of accepted `-profile` values = `source/slang/slang-profile-defs.h` (`PROFILE_VERSION`/`PROFILE` GLSL entries start at `GLSL_150`). The GLSL emitter's version map `_getGLSLVersion` (`slang-emit-glsl.cpp:3304-3325`) also only handles 150…460. `-profile <name>` resolves via `Profile::lookUp(name)` (`slang-global-session.cpp:922-924`, `findProfile`); a miss → `E00014`. Slang deliberately targets **core-profile GLSL 150+** and floors `#version` to ~450, so legacy pre-core versions (110-140) are unsupported for codegen. Note `_GLSL_130`/`_GLSL_140` DO exist but only as **capability atoms** (`slang-capabilities.capdef:171-173`) — a different enum from `ProfileVersion`; don't confuse the two.

**How to apply:** For any "advertised CLI value not recognized" bug, compare the help string against the real lookup table, not just the docs. The `-profile` list lives in **three** places that must stay in sync: (1) the help string `source/slang/slang-options.cpp:551`; (2) `docs/command-line-slangc-reference.md` — AUTO-GENERATED, and the **check-cmdline-ref CI gate** diffs it against `slangc -help-style markdown -h`, so editing the help string REQUIRES regenerating this doc or CI goes red; (3) `docs/user-guide/a3-01-reference-capability-profiles.md` — hand-maintained (and independently stale: its `sm_` list stops at 6_7 while options go to 6_10). Principled fix for such advertise-vs-reject mismatches is to correct the advertisement (drop the phantom values), NOT to wire up unsupported codegen — adding them as profiles when the emitter ignores/floors them creates a worse accept-then-silently-ignore inconsistency.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782980898198-slangc-h-advertises-glsl-110-120-130-140-profiles-.md`_
