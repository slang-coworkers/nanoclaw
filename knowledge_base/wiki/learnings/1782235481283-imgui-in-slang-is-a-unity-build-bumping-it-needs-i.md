---
title: "imgui in slang is a unity build; bumping it needs IMGUI_DEFINE_MATH_OPERATORS"
type: learning
topic: slang-compiler
source: learnings/1782235481283-imgui-in-slang-is-a-unity-build-bumping-it-needs-i.md
---

# imgui in slang is a unity build; bumping it needs IMGUI_DEFINE_MATH_OPERATORS

When bumping `external/imgui` in shader-slang/slang (e.g. slang#11711, v1.68→v1.92.8):

- imgui is consumed **only as a unity build** — `tools/platform/gui.cpp` `#include`s the imgui `.cpp` sources at the bottom of the translation unit. The `imgui` CMake target is **INTERFACE-only** (just adds the include dir). So a submodule pointer bump needs **zero CMake change**, and `gui.cpp`/`gui.h` are the ONLY in-tree consumers (grep confirms; CUDA `TexRef` names are unrelated).
- **`#define IMGUI_DEFINE_MATH_OPERATORS` must lead the TU**, before the first `imgui.h` include. Since imgui v1.89.4 the `ImVec2/4` operators are macro-guarded and `imgui_internal.h:115` raises `#error Please '#define IMGUI_DEFINE_MATH_OPERATORS' _BEFORE_ including imgui.h!`. In gui.cpp the define must precede `#include "gui.h"` (which pulls imgui.h) AND cover the unity `.cpp` includes at the bottom.
- Other v1.68→v1.92 API moves the consumer hits: `examples/`→`backends/` dir rename (v1.80); `imgui_tables.cpp` split out of `imgui_widgets.cpp` (v1.80, must be added to the unity block); `ImTextureID` became 64-bit `ImU64` and `ImFontAtlas::TexID`→`TexRef` (type `ImTextureRef`) — legacy ptr round-trip is `SetTexID((ImTextureID)(size_t)ptr)` / `TexRef.GetTexID()` (v1.92).
- Cheap validation without the full slang build: isolated unity-compile probe `g++ -std=c++17 -c -I external/imgui gui.cpp` proves the migration AND that the `#error` fires/clears with the define — and confirms include-case on a case-sensitive FS. The win32 `#ifdef _WIN32` backend path stays reasoned-only on Linux; CI's Windows matrix covers it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782235481283-imgui-in-slang-is-a-unity-build-bumping-it-needs-i.md`_
