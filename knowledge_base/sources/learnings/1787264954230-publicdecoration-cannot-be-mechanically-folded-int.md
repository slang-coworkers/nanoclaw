---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787264386039-hj68zl
written_at: 2026-08-20T22:29:14.230Z
---

# PublicDecoration cannot be mechanically folded into export/HLSLExport (#12667)

Triaging #12667 (remove `kIROp_PublicDecoration`, "fold consumers into the neighboring export/HLSLExport check"): the fold is NOT behavior-preserving, and this is worth knowing before anyone attempts the cleanup again.

**Why:** `PublicDecoration` is the *sole* IR marker for the Slang `public` VISIBILITY concept. Producer `slang-lower-to-ir.cpp:~1442` adds it for every decl of `DeclVisibility::Public` (`PublicModifier`, synthesized in `slang-check-decl.cpp:~3694`), in an `else if` branch **mutually exclusive** with the `HLSLExportModifier` branch. So a plain-`public` decl carries `PublicDecoration` + the unconditional `ExportDecoration`, but NOT `HLSLExportDecoration`.

All ~11 consumers OR `Public` with `HLSLExport` as an *equivalent-but-broader* signal. Narrowing any to just the HLSLExport clause silently regresses the common `public`-only case: host CPU emit reverts to `static` (`isPublicOrExportedFunc`/`_isExported`/`_getExportStyle` in slang-emit-cpp.cpp), lost HLSL/Metal `export` keyword, revived E41017 for the `__global public __extern_cpp` pattern (`isHostProvidedGlobal`), changed type-legalization (`isSimpleType`) and cloning (`cloneExtraDecorationsFromInst`, `isSimpleDecoration`).

**Key trap:** once the op is gone there is NO surviving IR signal that distinguishes `public` from `internal` — `ExportDecoration` is applied to ALL non-import decls. So the op can't just be deleted; `public` must be deliberately re-mapped, and every mapping (→nothing / →Export / →HLSLExport) changes behavior somewhere. Mapping public→HLSLExport is the only route that removes the op, but it widens a module's export surface (linker `getHLSLExports()` collects HLSLExport, not Public) — a language-semantics change, not a mechanical cleanup. That's why #12304's producer-side delete got REQUEST_CHANGES.

**How to apply:** Treat "remove PublicDecoration" as blocked on a maintainer decision about what `public` on a decl should mean (visibility-only, as docs/cpu-target.md:210 states, vs. the linkage/retention it's currently treated as). Only safe mechanical step: drop the redundant `addPublicDecoration(wrapper)` at `slang-ir-dll-export.cpp:~27` (wrapper already has HLSLExport). Also: `PublicDecoration` is NOT an IRLinkageDecoration, so linking/DCE gate on ExportDecoration and are unaffected by its removal.
