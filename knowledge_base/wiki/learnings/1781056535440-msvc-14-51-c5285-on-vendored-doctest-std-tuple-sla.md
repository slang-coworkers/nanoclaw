---
title: "MSVC 14.51 C5285 on vendored doctest (std::tuple) — slang-rhi"
type: learning
topic: slang-compiler
source: learnings/1781056535440-msvc-14-51-c5285-on-vendored-doctest-std-tuple-sla.md
---

# MSVC 14.51 C5285 on vendored doctest (std::tuple) — slang-rhi

## MSVC 14.51.x C5285 breaks doctest-based test builds under /WX

**Symptom:** MSVC May-2026 update (18.6.2 / 14.51.36231, cl 19.51; GH runner image v20260520.533) emits `warning C5285: cannot declare a specialization for 'std::tuple': Specializing this standard library template is forbidden by N5014 [tuple.tuple.general]/1` on doctest's vendored `std` forward-declarations (doctest.h forward-declares `std::tuple`, `basic_ostream`, etc. to avoid heavy includes). Under `/WX` this becomes `error C2220`, failing the build.

**In slang-rhi:** vendored doctest is 2.4.11 (the decl is at doctest.h:539). `slang-rhi-tests` is the sole doctest consumer (doctest is an INTERFACE lib; only target_link to it is the test target). The `/WX` comes from the `slang-rhi-warnings-as-errors` INTERFACE.

**Fix options (in order of blast radius):**
1. `target_compile_options(slang-rhi-tests PRIVATE $<$<CXX_COMPILER_ID:MSVC>:/wd5285>)` — minimal, MSVC-only, scoped to the one doctest consumer. Does NOT touch the shared `slang-rhi-warnings` interface (no over-suppression of the library proper). This is what slang-rhi#772's patch does. Older MSVC silently accepts an unknown `/wd` number, so it's harmless there.
2. `DOCTEST_CONFIG_USE_STD_HEADERS` defined on the test target — makes doctest `#include <tuple>/<ostream>` instead of forward-declaring std types, removing the non-conforming root cause. No doctest bump needed; cost = heavier STL includes → slower test compiles. (Maintainer-suggested.)
3. Bump vendored doctest — **does NOT work via a release yet**: doctest fixed this in PR #1160, slated for **v2.6 (unreleased)**; latest tagged release is v2.5.2 (2026-04-14) which predates the fix. Only an untagged master commit has it (larger scope/risk).

**Removal trigger:** once doctest v2.6 releases and the vendored copy is bumped, the `/wd5285` suppression can be dropped.

**Refs:** doctest issue #1159 (closed 2026-06-07), PR #1160; MSVC's own suggested workaround `/Wv:18` is broader (disables ALL post-v18 warnings) — `/wd5285` is the surgical choice.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781056535440-msvc-14-51-c5285-on-vendored-doctest-std-tuple-sla.md`_
