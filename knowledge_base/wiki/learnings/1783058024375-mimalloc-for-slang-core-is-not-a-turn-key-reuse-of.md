---
title: "mimalloc 'for Slang core' is not a turn-key reuse of the SPIRV-Tools integration"
type: learning
topic: slang-compiler
source: learnings/1783058024375-mimalloc-for-slang-core-is-not-a-turn-key-reuse-of.md
---

# mimalloc "for Slang core" is not a turn-key reuse of the SPIRV-Tools integration

Triaging shader-slang/slang#11925 ("Use mimalloc for Slang core"). The issue frames it as reusing the existing SPIRV-Tools mimalloc dependency, but the actual mechanism does NOT transfer cleanly:

- **SPIRV-Tools' shim only overrides `operator new`/`delete`.** `external/spirv-tools/source/mimalloc.cpp` is literally `#include "mimalloc-new-delete.h"` + linking `mimalloc-static`. That header overrides C++ `operator new`/`delete` only — NOT C `malloc`/`free`.
- **Slang core has no single allocation choke point.** `StandardAllocator` (`source/core/slang-allocator.h:37-46`, its `allocate()` even tagged "not really called") wraps `::malloc`/`::free`, AND direct `::malloc`/`::free`/`::realloc` calls are scattered across `slang-memory-arena.cpp`, `slang-free-list.cpp`, `slang-blob.h`, `slang-rtti-util.cpp`, `slang-offset-container.cpp`. Object allocation also flows through global `operator new/delete`.
- **The `::` scope-resolution defeats macro overrides.** `::malloc` forces the global CRT symbol; mimalloc's `mimalloc-override.h` (`#define malloc mi_malloc`) can't intercept it, and neither can the new/delete shim. So copying SPIRV-Tools' one-liner would silently miss every `::malloc` site.
- **Two real mechanism options:** (A) Windows transparent redirect via `mimalloc-redirect.dll` — patches the process import table so all malloc/free route to mimalloc with zero source edits, but swaps the allocator for the entire host process embedding `slang.dll` and requires shipping the extra DLL in release artifacts; (B) explicit conversion of Slang's `::malloc`/`::free` sites + a new/delete shim behind a `SLANG_USE_MIMALLOC` guard — portable and side-effect-free, but ~6 files and a `mi_malloc`↔`::free` mismatch is a UB/crash.
- **Mixed-allocator crash hazard is real.** PR #8419 kept SPIRV-Tools mimalloc Windows-only precisely because static mimalloc crashed on Linux/macOS from mixing system malloc + mimalloc. A *partial* conversion of Slang core would be worse.

Prior art: issue #8158 → PR #8419 (merged `8ad0ae17`, option `SLANG_ENABLE_SPIRV_TOOLS_MIMALLOC`, default ON Win/OFF else, `CMakeLists.txt:211-221`), refined by #8460 (option dedup) and #8676 (path override). The mimalloc clone lives at `external/CMakeLists.txt:240-296` (microsoft/mimalloc v2.1.7 → `external/mimalloc`, exposes `mimalloc-static`).

Takeaway for triage/fix: "add mimalloc for X" requests need you to check whether X allocates through a single hookable choke point or through scattered `::malloc`/global-`new`. If scattered, it's a design call (redirect-DLL vs guarded per-site conversion), not a config toggle.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783058024375-mimalloc-for-slang-core-is-not-a-turn-key-reuse-of.md`_
