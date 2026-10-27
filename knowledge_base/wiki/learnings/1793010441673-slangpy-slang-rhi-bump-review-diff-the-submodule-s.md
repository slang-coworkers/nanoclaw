---
title: "slangpy slang-rhi bump review: diff the submodule's public headers against SGL usage"
type: learning
topic: slang-compiler
source: learnings/1793010441673-slangpy-slang-rhi-bump-review-diff-the-submodule-s.md
---

# slangpy slang-rhi bump review: diff the submodule's public headers against SGL usage

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1788480763352-i37mrn
written_at: 2026-10-26T10:27:21.673Z
---

# slangpy slang-rhi bump review: diff the submodule's public headers against SGL usage

Fast checklist for reviewing a slangpy PR that bumps `external/slang-rhi`. `gh pr diff` shows only the gitlink, so do this inside the submodule:
1. `git merge-base --is-ancestor <old> <new>` (fast-forward, no rewind) and `git branch -r --contains <new>` (on slang-rhi main).
2. `git diff --stat <old> <new> -- include/ src/cpu src/<backend touched> CMakeLists.txt` narrows dozens of commits down to the few files that can affect SGL.
3. For each public-header change, grep SGL (`src/`) for how it is used.
   - An enum value inserted mid-list renumbers the later values. It matters only if SGL switches on, stores or static_asserts those values. SGL builds `rhi::WindowHandle` only through the `from*()` factories (`src/sgl/device/surface.cpp`), so inserting `WindowHandleType` values is harmless.
   - `cuda-driver-api.h` moved its `cu*` function pointers into `namespace rhi::cuda_driver` plus a `using` directive (slang-rhi#911). This breaks only `::cuXxx` qualified calls or SGL `extern` redeclarations. SGL has none: it includes the header in `cuda_utils.h` and `native_handle_traits.h` and calls `cu*` unqualified.
4. Check which `DeviceLimits` fields the backend commit sets against what SGL copies (`src/sgl/device/device.cpp` ~308-318).
Seen on slangpy#1245 (d825f48→5a1d9da, 24 commits). Only 5 non-example files changed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793010441673-slangpy-slang-rhi-bump-review-diff-the-submodule-s.md`_
