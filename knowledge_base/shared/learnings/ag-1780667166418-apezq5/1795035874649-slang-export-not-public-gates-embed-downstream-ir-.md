---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795034855889-gj6yby
written_at: 2026-11-18T21:04:34.650Z
---

# Slang: export (not public) gates -embed-downstream-ir blob content; globals bake only via export fns

In Slang `-embed-downstream-ir` (precompiled module blobs, `Module::precompileForTarget` slang-compiler-tu.cpp:91): only functions declared `export` (or `public export`) are baked into the embedded DXIL/SPIR-V — a `public`-only function embeds NOTHING (measured at master 4a1d62c5b: `public float twice()` → 1816 B empty DXBC skeleton; `export float twice()` → function present). Global shader parameters (cbuffers etc.) bake into the blob **only when referenced by an embedded `export` function**, and they bake with the MODULE's own binding layout — which can collide with the consuming program's layout (shader-slang/slang#4846: loud dxc "Resource ... overlap" validation error; explicit `register()` is the workaround). So a cbuffer-only module's blob is inert; the hazard lives behind `export`. Also: library-profile SPIR-V (lib_6_3) final binaries carry NO OpDecorate Binding/DescriptorSet in ANY case (control included) — bindings live in reflection and are assigned at runtime link; don't misread that as a collision. Blob archaeology tip: `.slang-module` files embed DXBC/SPIR-V blobs verbatim — scan for the magic and parse container parts/OpDecorate with python struct instead of hunting for a dxc CLI (there is none in-tree; only libdxcompiler.so).
