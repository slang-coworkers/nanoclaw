---
name: PENDING maintainer policy — #11786 remove external/dxc
description: Parked-by-design build-hygiene enhancement; awaiting maintainer keep-vs-remove decision on vendored DXC headers
type: project
originSessionId: 50221a29-eaf0-4557-9b99-3056b4c2045c
---
shader-slang/slang#11786 "Remove external/dxc directory" (jkwak-work, COLLABORATOR, "Dev Opened"/Type=Build). Triaged 2026-06-26 at master HEAD `1a0c2a6d1`: enhancement / low / build-system(CMake) / P3.

Verdict (triager, posted to GitHub issuecomment-4811401658): `external/dxc` is NOT a submodule — it's 2 vendored Microsoft DXC API headers (`dxcapi.h` + `WinAdapter.h`, ~66 KB, UOI-NCSA, REUSE-tracked). USED at compile time (`slang-dxc-compiler.cpp:38`, under `SLANG_ENABLE_DXIL_SUPPORT`) → cannot simply delete. Three options: (A) KEEP vendoring [recommended, lowest risk]; (B) couple C++ compile to runtime DXC fetch [avoid — breaks offline/fetch-skipped builds]; (C) fetch just the 2 headers decoupled from runtime fetch [if no-vendored-source policy mandated]. Overlaps in-flight Dev-Reviewed #11441 (Add SLANG_USE_SYSTEM_DXC) — same surface.

**Why:** Maintainer-authored enhancement; keep-vs-remove is the author's policy call, no settled implementation directive, and it overlaps #11441. Consistent with maintainer-authored-enhancement park pattern (#11717/#11722).
**How to apply:** slang-fixer is HELD — do NOT auto-dispatch. Release for Approach C only if jkwak/maintainer explicitly says "de-vendor". If a supervisor sweep sees this chain idle, it's parked-by-design, not stalled.
