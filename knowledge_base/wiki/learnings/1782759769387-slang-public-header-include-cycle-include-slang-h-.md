---
title: "Slang public-header include cycle: include slang.h OUTSIDE your own guard"
type: learning
topic: slang-compiler
source: learnings/1782759769387-slang-public-header-include-cycle-include-slang-h-.md
---

# Slang public-header include cycle: include slang.h OUTSIDE your own guard

When you add a NEW public header under `include/` that (a) is `#include`d by `slang.h` and (b) needs `slang.h`'s own types (opaque `Slang*` typedefs, `SLANG_API`, `slang::ISession` fwd-decl, enums), you create a mutual-include cycle: `slang.h` → newheader → `slang.h`. If the new header uses `#pragma once` (or a normal `#ifndef` guard around the WHOLE file) and `#include "slang.h"` inside it, then **including the new header FIRST fails to compile**: the nested `slang.h` reaches its own `#include "newheader.h"` line, that re-include is suppressed by the guard, so the prototypes are never declared before `slang.h`'s later inline wrapper code that calls them. (Verified on shader-slang/slang#11826: `#include "slang-reflection.h"` alone → `error: 'spReflectionType_GetKind' was not declared` at slang.h:2369.)

FIX (clean, minimal): in the new header put `#include "slang.h"` UNCONDITIONALLY, BEFORE the header's own `#ifndef NEWHEADER_H` guard. Then `slang.h` always drives the include order — on a newheader-first include, the nested `slang.h` re-enters the new header at slang.h's `#include` line (where `NEWHEADER_H` isn't defined yet) and declares the prototypes there, ahead of slang.h's wrappers; `slang.h`'s own `#ifndef SLANG_H` breaks the recursion. All include orders + double-include then compile.

Notes: `slang.h`/`slang-com-helper.h`/`slang-com-ptr.h` use `#ifndef SLANG_*_H` guards (only `slang-deprecated.h` uses `#pragma once`) — match the `#ifndef` convention. This is a PRE-EXISTING property of the cluster: on master, `#include "slang-deprecated.h"` alone ALSO fails identically (deprecated.h uses pragma once + the cycle) — so the canonical/only-supported entry is `slang.h`. Verify include behavior cheaply with `g++ -std=c++17 -fsyntax-only -Iinclude` on 1-line TUs per header. Also: public headers auto-install via the `include/slang*.h` glob in source/slang/CMakeLists.txt (`file(GLOB CONFIGURE_DEPENDS)`) — a new `slang-*.h` needs NO CMake edit; confirm it lands in build/source/slang/cmake_install.cmake.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782759769387-slang-public-header-include-cycle-include-slang-h-.md`_
