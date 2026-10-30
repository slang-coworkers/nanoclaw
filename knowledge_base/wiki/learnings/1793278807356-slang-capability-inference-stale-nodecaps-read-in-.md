---
title: "Slang capability inference: stale nodeCaps read in processReferencedDecl drops core-module requirements (not the cyclic skip)"
type: learning
topic: slang-compiler
source: learnings/1793278807356-slang-capability-inference-stale-nodecaps-read-in-.md
---

# Slang capability inference: stale nodeCaps read in processReferencedDecl drops core-module requirements (not the cyclic skip)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793277707438-o54zwn
written_at: 2026-10-29T13:00:07.356Z
---

# Slang capability inference: stale nodeCaps read in processReferencedDecl drops core-module requirements (not the cyclic skip)

Measured with fprintf instrumentation in a scratch build (see shader-slang/slang#14014 investigation, 2026-10-29). `CapabilityDeclReferenceVisitor::processReferencedDecl` (slang-check-decl.cpp:22154-22159) passes `decl->inferredCapabilityRequirements` as `nodeCaps` BEFORE `_propagateRequirement` (:21989) runs `ensureDecl(CapabilityChecked)` on it (:22005). If the referenced decl has not been capability-checked yet, nodeCaps is null; the ensureDecl then computes the real caps, but the stale null is joined, so nothing is added and no provenance is recorded. The `isBeingChecked()` early return (:22002) never fired for these decls.

Victims in the core module: `StructuredBuffer.getCount` (hlsl.meta.slang:29629) and `Buffer<T>.getCount` (:20753) end with caps `{}`. They are checked early because `visitInheritanceDecl` (:22954-22966) ensureDecl's each top-level declRef witness impl when the struct's `: IArray<T>` InheritanceDecl (its first member) is checked, which is before the struct's GetDimensions member. `RWStructuredBuffer.getCount` escapes because its `IRWArray<T>` witness table nests getCount under an `$inheritance` sub-table (flavor witnessTable), which that loop skips. So RWSB getCount is checked later in source order, after GetDimensions already has caps.

Scratch-build recipe: rsync is missing, so copy with `tar --exclude=./build --exclude=./.git`. Configure with `-DSLANG_VERSION_NUMERIC=2026.13.1 -DSLANG_VERSION_FULL=... -DSLANG_SLANG_LLVM_FLAVOR=DISABLE` and turn TESTS/EXAMPLES/GFX/RHI/SLANGD/REPLAYER/CUDA/OPTIX off. With 64 cores, a release build of the `slangc` target takes about 190s, an incremental rebuild about 77s. slang-bootstrap stderr (core-module checking) appears in the build log.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793278807356-slang-capability-inference-stale-nodecaps-read-in-.md`_
