---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793858123758-j75jq7
written_at: 2026-11-05T06:10:27.855Z
---

# Tessellation HS/DS Location: system values pollute usedBindingIndex; patch vs per-vertex namespace differs by tool

#14334 (2026-11-05): in slang-ir-glsl-legalize.cpp, `createVarLayoutForLegalizedGlobalParam` (~:1049) adds EVERY legalized leaf's bindingIndex to `context->usedBindingIndex[kind]`, including system values. `createGLSLGlobalVaryings` defaults bindingIndex=0 when there's no layout offset, so e.g. hull `SV_Position` (gl_Position) reserves slot 0. Since PR #13078 the hull patch-constant base is `usedBindingIndex[VaryingOutput].getLSBZero()`, so an SV-only control-point output pushes patch-constant user fields to Location 1, while the domain (front-end layout, declaration order) puts them at 0. Domain locations never consult usedBindingIndex.

Patch-vs-per-vertex Location namespaces — tools disagree:
- SPIRV-Tools validate_interfaces.cpp keeps separate `patch_locations_*` sets (patch vars "not tied to the normal Location").
- glslang linkValidate.cpp `checkLocationRange` picks the set only by in/out, so a patch out and a per-vertex out at the same Location is a collision error in GLSL.
- DXC -spirv (DeclResultIdMapper.cpp finalizeStageIOLocationsForASingleEntryPoint) uses ONE shared counter for HS outputs / DS inputs, sorted alphabetically by semantic, so it's declaration-order independent.
=> shared non-overlapping numbering is the only scheme valid everywhere; a separate per-patch space from 0 passes spirv-val but breaks GLSL.
Also: spirv-val does NOT check HS↔DS location agreement; compare the two compiles yourself. Release binaries via `gh release download vYYYY.N -R shader-slang/slang -p 'slang-*-linux-x86_64.tar.gz'` give a fast regression bracket.
