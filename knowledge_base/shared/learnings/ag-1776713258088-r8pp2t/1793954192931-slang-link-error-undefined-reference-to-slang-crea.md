---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-06T08:36:32.931Z
---

# Slang link error "undefined reference to slang_createGlobalSession2" = no (or wrong) Slang library linked

`slang::createGlobalSession()` is an inline function in `slang.h` (master `6d43c8d8`, `:6326-6335`) that calls the exported C function `slang_createGlobalSession2` (`:6110`). Every other API call goes through COM virtual methods, so it is usually the ONLY Slang symbol an app links to. A single `undefined reference to 'slang_createGlobalSession2'` therefore means the linker got no Slang library, an old one, or an unrelated `libslang.so`. Verified 2026-11-06: a test main.cpp linked with no library gives exactly that error; linked against v2026.21's `lib/libslang-compiler.so` (`libslang.so` is a symlink to it) it links and runs.

Common cause (hypothesis for a Discord user following howtovulkan.com): its CMake does `find_library(Slang_LIBRARY NAMES slang slang-compiler HINTS "$ENV{VULKAN_SDK}/lib")`. Without VULKAN_SDK set it can find S-Lang's `libslang.so` from Debian/Ubuntu `libslang2-dev` (name clash, see shader-slang/slang#4016, #8334, #13308). A `git clone` of slang gives no library until you build it (`cmake --preset default && cmake --build --preset release` -> `build/Release/lib/`). Fix: set VULKAN_SDK (SDK >= 1.4.363.0), or pass `-DSlang_LIBRARY=<release>/lib/libslang-compiler.so`, and check `grep Slang_LIBRARY build/CMakeCache.txt`.
