---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786659332908-1zsqrb
written_at: 2026-08-13T23:03:37.774Z
---

# [approver/clause-gap] Slang type layout has TWO parallel entry points with independent UB catch-alls — a fix adding a type case to _createTypeLayout must be checked against getSimpleVaryingParameterTypeLayout too

**Symptom:** slang#12536 added a `ModifiedType` case to `_createTypeLayout` (uniform/buffer/global-param layout) to fix a release-UB SIGSEGV (#12535), and its title claimed the general property "lay out a modified type as the type it modifies." But it left a `unorm`/`snorm` field of an entry-point **varying** struct still unhandled, reaching a second, identical UB-shaped catch-all.

**Root cause / the class of signal:** Slang computes type layout in TWO structurally-parallel, non-shared functions in `source/slang/slang-type-layout.cpp`:
- `_createTypeLayout` (~5308) — non-varying (uniform / constant-buffer / structured-buffer / global-param) layout. Catch-all: `SLANG_ASSERT(!"unimplemented case in type layout")` (~6190).
- `getSimpleVaryingParameterTypeLayout` (~6194) — entry-point varying input/output layout. Its OWN catch-all: `SLANG_ASSERT(!"unimplemented case for varying parameter layout")` (~6403).
Both asserts are `SLANG_ASSUME`→UB in release. The varying path is fed by `processEntryPointVaryingParameter` (`slang-parameter-binding.cpp:2342`), which recurses into struct fields and dispatches leaf basic/vector/matrix/ptr to the varying layout function — it too has no `ModifiedType` case (unmatched → `SLANG_UNEXPECTED` at :2940). The function's own top comment admits the duplication: "This logic should ideally share as much as possible with `_createTypeLayout` ... but ... varying parameter layout differs." So a type-case added to one is NOT automatically present in the other.

**How to catch it (transferable review probe):** When a PR adds a case for a new type/shape to ONE layout function to fix a "fell through to the catch-all" bug, grep for the SIBLING catch-alls and verify the new type can't reach them:
`grep -n "unimplemented case" source/slang/slang-type-layout.cpp` (finds both entry points)
then ask: can this type appear as an entry-point varying parameter (or a field of one)? If yes and the varying function has no matching case, the fix is incomplete for its general claim — the same UB class remains live on the varying path. This generalizes beyond layout: any "add a case to the big type switch" fix should be checked against every parallel switch over the same type universe (layout has 2; emit/legalization often have per-target variants).

**Fix / disposition:** This is a legitimate ABSTAIN_POLICY:OPEN_GAP for the approver (needs a human to scope: fix both paths here, or track the varying path as follow-up under #8870). The durable compiler lesson: the real root-cause fix for this UB CLASS is to make the shared catch-all a `SLANG_RELEASE_ASSERT`/diagnostic (the PR author themselves noted this as deliberately-out-of-scope follow-up), so any unhandled type on EITHER path becomes a deterministic error instead of platform-dependent UB.
