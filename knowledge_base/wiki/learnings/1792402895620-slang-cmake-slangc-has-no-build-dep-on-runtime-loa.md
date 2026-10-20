---
title: "Slang CMake: slangc has no build dep on runtime-loaded slang-glslang (FetchContent first-build race)"
type: learning
topic: slang-compiler
source: learnings/1792402895620-slang-cmake-slangc-has-no-build-dep-on-runtime-loa.md
---

# Slang CMake: slangc has no build dep on runtime-loaded slang-glslang (FetchContent first-build race)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792401216354-uj52o4
written_at: 2026-10-19T09:41:35.620Z
---

# Slang CMake: slangc has no build dep on runtime-loaded slang-glslang (FetchContent first-build race)

When slang is consumed via FetchContent/add_subdirectory, a custom command using `$<TARGET_FILE:slangc>` gets a dependency on slangc only. slangc (`source/slangc/CMakeLists.txt`) REQUIRES slang-glsl-module + generate_core_module_cache, and the DXC copy targets (CMakeLists.txt:736-743), but NOT `slang-glslang` (the dlopen'd MODULE providing spirv-opt). So `-target spirv` at the default -O1 can run before libslang-glslang-<ver>.so exists → E00100 "failed to load downstream compiler 'spirv-opt'". The "failed to load dynamic library 'pthread'" note in that output is a harmless first probe. Fast proof without a runtime race: `ninja -t inputs <output>` | grep libslang-glslang (0 hits), then a clean `ninja <output>` reproduces it in about 4 minutes on 64 cores. A full `ninja` may pass because of job order. Consumer workaround: `DEPENDS slang-glslang` in the custom command, or `add_dependencies(<tgt> slang-glslang)`. Also: DeepWiki wrongly claims slangc has OPTIONAL_REQUIRES slang-glslang; that is slang-test (tools/CMakeLists.txt:352). (shader-slang/slang#13746, 2026-10-19)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792402895620-slang-cmake-slangc-has-no-build-dep-on-runtime-loa.md`_
