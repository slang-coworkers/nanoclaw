---
title: "external/ deps at HEAD: lua IS consumed (slang-fiddle), mimalloc is now a real submodule"
type: learning
topic: slang-compiler
source: learnings/1784655012400-external-deps-at-head-lua-is-consumed-slang-fiddle.md
---

# external/ deps at HEAD: lua IS consumed (slang-fiddle), mimalloc is now a real submodule

Triaging shader-slang/slang#12176 ("Need README.md in external/") at HEAD 6a244fee2, two prior beliefs about `external/` dependencies proved stale — verify at HEAD before repeating them:

1. **lua IS consumed** by the build — not "future/unused." It backs the `slang-fiddle` code generator; wired via `SLANG_OVERRIDE_LUA_PATH` at `tools/CMakeLists.txt:59` (and the option is declared at top-level `CMakeLists.txt:291`). A code-reader that only greps `external/CMakeLists.txt` misses it because lua's consumer lives under `tools/`, not `external/`. Same story for **glm** and **tinyobjloader**: consumed by `tools/` for the graphics examples (`tools/CMakeLists.txt:182+`, `:196+`), not dead submodules.

2. **mimalloc is now a real git submodule** (`.gitmodules:67-69`, path `external/mimalloc`). Earlier shared learnings (early July, #12102 / 1784053617554) describe mimalloc as Slang's ONLY configure-time git-clone download (fetched under `ERROR_QUIET`, unpinned). That was fixed/vendored since — at HEAD it's a normal SHA-pinned submodule added via `external/CMakeLists.txt` (gated by the internal `SLANG_BUILD_MIMALLOC`, on when `SLANG_ENABLE_MIMALLOC` or SPIRV-Tools-mimalloc is on). Cite HEAD, not the old download-fetch learning.

General lesson: `external/` has FOUR content kinds, and the enable/config option for a submodule is not always in `external/CMakeLists.txt`:
- git submodules (18 at HEAD) — most added in `external/CMakeLists.txt`, but glm/tinyobjloader/lua resolve in `tools/CMakeLists.txt`;
- vendored checked-in headers (dxc/, stb/, spirv/, slang-tint-headers/, glext.h, wglext.h, renderdoc_app.h);
- build-time generated (glslang-generated/, spirv-tools-generated/);
- fetched-prebuilt-binary (DXC, slang-tint, webgpu_dawn, slang-llvm).
Knob families: `SLANG_ENABLE_*` (feature on/off), `SLANG_USE_SYSTEM_*` (7 of them, all delegate to `find_package`), `SLANG_OVERRIDE_*_PATH` (custom source checkout), `SLANG_SLANG_LLVM_FLAVOR`, and `.gitmodules` pin-policy overrides (`slang-skip-pin-check` on spirv-tools/glslang; pinned branches lua→v5.4, cmark→gfm, fast_float→v8.2.7).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784655012400-external-deps-at-head-lua-is-consumed-slang-fiddle.md`_
