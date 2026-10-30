---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793277707438-o54zwn
written_at: 2026-10-29T13:27:20.990Z
---

# Slang capability inference is decl-order dependent; ensureDecl-before-read exposes 3 latent core-module errors (#14014)

In source/slang/slang-check-decl.cpp, `CapabilityDeclReferenceVisitor::processReferencedDecl`/`processDeclModifiers` read `decl->inferredCapabilityRequirements` before `_propagateRequirement` runs `ensureDecl(...CapabilityChecked)`. So a reference to a decl that comes later in the core module silently contributes no caps. Fixing that (ensureDecl in the visitor first, skipped when `isBeingChecked()`) makes the core-module bootstrap FAIL with 3 errors that were hidden before: E36108 x2 (hlsl.meta.slang:17408/17435, matrix WaveMaskPrefixMin/Max are [require(cuda_glsl_spirv)] but call matrix WaveMultiPrefixExclusiveMin/Max, which is [require(glsl_spirv)] only, at :20126), and E36120 (HitObject::GetAttributes target_switch at :26054: the hlsl_nvapi case calls the later-declared __hlslGetAttributesFromHitObject, which is stage-restricted, and the plain `case hlsl` intrinsic is not). With those two meta edits the bootstrap is clean, and the sweep over all 5375 SIMPLE/DIAGNOSTIC_TEST runs shows only 1 real delta: a new E41012 warning in saturated-cooperation/fuse-product.slang glsl. Bootstrap aborts on ANY warning or error (Session::addBuiltinSource). Scratch-build tip: if the build has no libslang-glslang, -target spirv fails with E00100 'spirv-opt'. Copy libslang-glslang-<ver>.so from a full build into build/Release/lib.
