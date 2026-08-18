---
title: "SLANG_OVERRIDE_*_PATH can be silently shadowed by a sibling dep's incidental public include"
type: learning
topic: slang-compiler
source: learnings/1782852472140-slang-override-path-can-be-silently-shadowed-by-a-.md
---

# SLANG_OVERRIDE_*_PATH can be silently shadowed by a sibling dep's incidental public include

**Context:** shader-slang/slang#11851 — `SLANG_OVERRIDE_IMGUI_PATH` did not take effect for the `platform` target / its GUI consumers, even though `external/CMakeLists.txt` correctly branches the `imgui` INTERFACE target's include dir to `${SLANG_OVERRIDE_IMGUI_PATH}/imgui`.

**Two non-obvious mechanisms (both must be checked for any SLANG_OVERRIDE_<DEP>_PATH "override ignored" report):**

1. **Incidental shadowing by a sibling dependency's broad public include.** The `platform` target adds `${slang_SOURCE_DIR}/external` (the whole bundled tree) as a PUBLIC include — but only inside the *GLM* override branch (`tools/CMakeLists.txt:349`, the `if(NOT SLANG_OVERRIDE_GLM_PATH)` arm). Because `external/` contains `external/imgui/` too, that GLM-intended path also resolves `#include "imgui/imgui.h"` — to the BUNDLED copy. So setting only `SLANG_OVERRIDE_IMGUI_PATH` (without also overriding GLM) leaves the bundled `external` on the include path and the override is never selected. Lesson: a broad `${SOURCE}/external` include added "for dep X" silently provides headers for *every* bundled dep, defeating their individual override options. Prefer per-dep leaf include dirs via each dep's INTERFACE target (single source of truth), never a blanket `external`.

2. **Include-spelling vs target-include-dir mismatch.** The `imgui` INTERFACE target exports the *leaf* dir (`external/imgui`, the dir containing `imgui.h`), so the canonical spelling is `#include "imgui.h"` (used by gui.cpp's `<imgui.cpp>`/`<backends/…>` and all imgui-internal files). One outlier, `tools/platform/gui.h:5`, spelled `#include "imgui/imgui.h"` (parent-relative), which the leaf dir cannot satisfy — so it only ever resolved via the incidental blanket `external` from (1). A `dep/dep.h` spelling requires the *parent* of `dep/` on the path; a `dep.h` spelling requires the leaf. Match the spelling to what the dep's INTERFACE target actually exports.

3. **public header + INCLUDE_FROM_PRIVATE = consumers can't find the dep.** `platform` exposes `gui.h` publicly but pulled imgui via `INCLUDE_FROM_PRIVATE imgui` (`tools/CMakeLists.txt:343`), so consumers (e.g. `examples/model-viewer`) that include the public `gui.h` (which transitively includes imgui) don't inherit imgui's include dir. If a public header transitively includes a dep, that dep's include dir must be propagated with `INCLUDE_FROM_PUBLIC` (the keyword exists: `cmake/SlangTarget.cmake:87,464`).

**Fix shape:** normalize the include spelling to the target's exported dir + make the dep `INCLUDE_FROM_PUBLIC` on the target that re-exports it through a public header. That makes the dep's INTERFACE target the single source of truth (it already branches override vs bundled) and removes reliance on any blanket `external` include.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782852472140-slang-override-path-can-be-silently-shadowed-by-a-.md`_
