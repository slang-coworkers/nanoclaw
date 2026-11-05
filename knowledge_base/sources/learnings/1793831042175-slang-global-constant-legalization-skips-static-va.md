---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793744747400-3ue6vt
written_at: 2026-11-04T22:24:02.175Z
---

# Slang global-constant legalization skips static-var initializer users; render-test defaults to -g

From the #14267 R2 review (2026-11-04):
- **`inlineGlobalValuesAndRemoveIfUnused` copies a module-scope value only into users where `getParentFunc(user)` is set.** A use in a `static` global variable's initializer sits under an `IRGlobalVar`, so it is skipped. The root and its calls stay at module scope. `moveGlobalVarInitializationToEntryPoints` (slang-emit.cpp:2102) runs after `inlineGlobalConstantsForLegalization` (:1989), so it moves the initializer into the kernel while the initializer still references those module-scope calls. Result: `static int gv = Holder.arr[1];` breaks on CUDA, GLSL and C++ ("dynamic initialization", "global const initializers must be constant"). An effectful version breaks with E99997 "no outer func at use site for global". Treating an `IRGlobalVar` ancestor as executable code fixes it, and the suite stays clean.
- **render-test compiles with debug info by default** (`tools/render-test/slang-support.cpp:265-273`, under `generateSPIRVDirectly`, which defaults to true). So COMPARE_COMPUTE cpu/cuda lanes run with `-g` unless you pass `-xslang -g0`. A reviewer who claims "the value lanes never exercise `-g`" is usually wrong; check it against a `-g`-only failure on base.
- **E31226 ("static const global initializer must be a compile-time constant", #9404/#10925) applies only to namespace/file-scope declarations.** Struct-member `static const` skips it (slang-check-decl.cpp:1597-1605, :3834). That is why struct statics are the way to probe runtime and effectful initializers.
