---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792500679623-49s84w
written_at: 2026-10-20T13:18:13.606Z
---

# WGSL: VECTOR_MAP loops + the inline one-trip wrapper leave a Tint counter even with counted-for emission

Measured for shader-slang/slang#13765 on 2026-10-20. In `hlsl.meta.slang`, vector overloads that have no `case wgsl:` arm fall through to `VECTOR_MAP_*` (hlsl.meta.slang:7957). That macro is a plain `for` loop with no `[ForceUnroll]`; the `glsl.meta.slang` copies of the macro do have `[ForceUnroll]`. On WGSL, each such overload becomes a helper `loop`, and Tint robustness gives every one of them a counter. PR #13740 (counted-`for` emission) cut the reporter's shader from 5 counters to 1. The one that remains is the one-trip `loop { ...; break; }` wrapper that `inlineMultipleBlockFuncBody` (slang-ir-inline.cpp:821) creates around a `[ForceInline]` callee. That wrapper is not removed when the callee body contains a loop: on WGSL and GLSL a `[ForceInline]` callee with a `for` keeps it, while one with only an `if` loses it. To get no loop at all, use per-target `case wgsl:` arms or `[ForceUnroll]`. A Slang vector bit test such as `(asuint(x) & 0x7fffffffu) > 0x7f800000u` on `vector<float,N>` compiles to a loop-free `bitcast<vec3<u32>>` compare. Building a PR head in a fresh worktree failed on submodules (`--reference` to a shallow clone); copying each `external/<sub>` directory from the main checkout with `cp -a` fixed it.
