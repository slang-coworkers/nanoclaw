---
title: "slang#9580 assoc-type-of-export-struct entry-point return crashes — stale post-link result layout (PR #8603 regression)"
type: learning
topic: slang-compiler
source: learnings/1783557222885-slang-9580-assoc-type-of-export-struct-entry-point.md
---

# slang#9580 assoc-type-of-export-struct entry-point return crashes — stale post-link result layout (PR #8603 regression)

**Symptom:** `[shader("fragment")]` entry point returning the *associated type of an `export`/`extern` struct* (`export struct ShaderMode : IShaderMode = SolidMode; typedef ShaderMode::FragOut FragOut; ... FragOut ps_main()`) crashes slangc `-target spirv`. Release: segfault in `createGLSLGlobalVaryingsImpl`. Debug/ToT: caught `SLANG_ASSERT` at `slang-ir-glsl-legalize.cpp(2166): structTypeLayout` (null-deref at :2203 `structTypeLayout->getFieldLayout()` in Release).

**Root cause (empirical, IR-dump confirmed):** type⇄layout mismatch. Bisected first-bad commit `6af3381f` = **PR #8603** ("Use symbol alias instead of wrapper synthesis to implement link-time types"). Post-#8603, `extern struct Foo : IFoo = Impl;` is resolved at link time via `IRSymbolAlias` (no synthesized wrapper). After linking the entry-point return type IS the concrete struct — IR dump shows `func %ps_main : Func(%ColorOutput)` — so `createGLSLGlobalVaryingsImpl` correctly enters the `else if (as<IRStructType>(type))` branch (line 2160). But the entry-point **result VarLayout's type-layout is never refreshed post-link**; it's still the pre-link *opaque associated-type* layout, so `as<IRStructTypeLayout>(typeLayout)` returns null → assert.

**Key discriminator (why some shapes work):** the intended post-link refresh is `processEntryPointVaryingParameter` → `context->layoutContext.lookupExternDeclRefType(declRefType)`, which resolves the extern DeclRefType and recurses on the concrete type, rebuilding the struct layout. It fires when the result type is *directly* the extern struct (issue's VARIANT 1 → works), but NOT when it's the *associated type of* an export struct (VARIANT 0 → crashes). Confirm with the reporter's VARIANT sweep: only VARIANT 0 crashes; 1-4 clear legalization.

**Fix direction:** principled fix is producer-side — rebuild entry-point result layouts post-link from IR semantics (NOT a null-guard at 2166, which masks: concrete struct with no field layout = wrong varyings). The reporter (@h3r2tic) already prototyped exactly this on branch `fix/link-time-entrypoint-layout`, key commit `661f23541` "Refresh entry-point result layouts after link-time specialization" (in `slang-ir-legalize-varying-params.cpp` + hook in `slang-emit.cpp`, +5 unit tests comparing concrete vs link-time layouts incl. SV_Target/user-semantics/vk::location/nested). When a contributor has a candidate branch, corroborate + help land it rather than build a parallel fix.

**Verify tip:** a Debug slangc built at a commit *newer* than `slang-ir-glsl-legalize.cpp`'s last change faithfully reflects the current crash path even if slightly behind HEAD — check `git log <bin-commit>..HEAD -- <file>` is empty before claiming "reproduces at ToT" (per the verify-empirically rule). The Debug assert and the Release segfault are the same bug (null structTypeLayout).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783557222885-slang-9580-assoc-type-of-export-struct-entry-point.md`_
