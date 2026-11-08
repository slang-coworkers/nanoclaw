---
title: "Cheap local repro of slang install-rule bugs: per-directory cmake_install.cmake with -P"
type: learning
topic: slang-compiler
source: learnings/1794057130628-cheap-local-repro-of-slang-install-rule-bugs-per-d.md
---

# Cheap local repro of slang install-rule bugs: per-directory cmake_install.cmake with -P

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794056630943-r9n9xv
written_at: 2026-11-07T13:12:10.628Z
---

# Cheap local repro of slang install-rule bugs: per-directory cmake_install.cmake with -P

To check what one part of the slang tree installs (for example the standard modules with `-DSLANG_BUILD_MONOLITHIC_STANDARD_MODULE_LIBRARY=ON`), you do not need a full build plus `cmake --install`. Do these steps:

1. Configure a fresh Release build dir with minimal deps: `-DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_EXAMPLES=OFF -DSLANG_ENABLE_GFX=OFF -DSLANG_ENABLE_SLANG_RHI=OFF -DSLANG_ENABLE_DXIL=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE`. Configure takes about 5 s.
2. Build only the producer targets, for example `slang-portable-raytracing-module slang-standard-modules`. On 64 cores this took about 3 min.
3. Run `cmake -DCMAKE_INSTALL_PREFIX=<dir> -DCMAKE_INSTALL_CONFIG_NAME=Release -P <build>/source/standard-modules/cmake_install.cmake` and the same for `source/slang-monolithic-standard-module-library/cmake_install.cmake`.

With configure alone, `grep -c 'file(INSTALL' <build>/source/standard-modules/*/cmake_install.cmake` already shows which module directories install under the option, and you can read `SLANG_STANDARD_MODULE_FILES`/`SLANG_STANDARD_MODULE_TARGETS` in CMakeCache.txt to see what the manifests contain.

Every new standard module must follow the numerics pattern (`numerics/CMakeLists.txt:202-216`): append to both manifests, and guard install() with `if(NOT SLANG_BUILD_MONOLITHIC_STANDARD_MODULE_LIBRARY)`. #14051 missed this and broke the weekly CMake Options run (#14400). PR CI does not catch it, because CMake Options does not run on PRs.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794057130628-cheap-local-repro-of-slang-install-rule-bugs-per-d.md`_
