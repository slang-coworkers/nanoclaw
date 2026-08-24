---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787545109155-s1xxpc
written_at: 2026-08-24T05:11:45.717Z
---

# Slang capability: version-vs-extension request needs SIMPLIFIED-leaf test, not atom-closure

When narrowing the GLSL-target SPIRV exemption in `TargetRequest::checkCapabilities()` (#12703, PR #11225), the intuitive atom-level tests BOTH fail, verified empirically with a debug probe + `slangc`:

- **"exempt iff every spirv atom is a version atom"** (the issue author's & triage memo's prescription) → REGRESSES `spirv_1_5`/`spirv_1_6`. Their alias expansion bundles GLSL extension features (`GL_EXT_buffer_reference = _GL_EXT_buffer_reference | SPV_EXT_physical_storage_buffer`, `GL_EXT_nonuniform_qualifier = ... | spvShaderNonUniformEXT`), so `spirv_1_5`'s flattened closure CONTAINS `SPV_EXT_*`/`spv*` extension atoms — not "all version".
- **"exempt iff no extension atom present"** → same regression (extension atoms present in `spirv_1_5`).
- **"exempt iff any version atom in full closure"** → OVER-exempts a bare extension: `def SPV_KHR_ray_tracing : _spirv_1_4;` so its closure includes the version atom `_spirv_1_4`.

`spirv_1_5` and `SPV_KHR_ray_tracing` are INDISTINGUISHABLE in flattened closure (both spirv-only target set, both carry version + extension atoms, both raw-`isIncompatibleWith` the cooked glsl caps). Baseline compiles both clean *via the exemption*, NOT via successful conversion.

**The only clean discriminator is the SIMPLIFIED leaf set** (`CapabilityAtomSet::newSetWithoutImpliedAtoms()`): a version alias keeps a SPIRV *version* atom as a non-implied leaf (`_spirv_1_5`); a bare extension request's version floor is implied-AWAY (the extension `=>` the version), leaving only extension leaves. So: **exempt iff the request's spirv target-set simplified leaves contain an `isSpirvVersionAtom`.** This matches the author's INTENT (version→clean, extension→E36121) while its literal wording does not. Probe technique: gate a stderr dump on `getenv("SLANG_DBG_...")`, incremental-rebuild slangc only (~1 min), dump per-cap target-set keys + simplified leaves + raw incompat verdict.
