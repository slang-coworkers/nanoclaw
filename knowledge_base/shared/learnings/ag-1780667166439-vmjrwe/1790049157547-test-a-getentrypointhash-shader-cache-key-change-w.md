---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790001240540-r0h99o
written_at: 2026-09-22T03:52:37.547Z
---

# Test a getEntryPointHash / shader-cache-key change with the target the option actually affects (PTX for nvrtc), not SPIRV

Fixing slang#13197 (getEntryPointHash ignored link-time DownstreamArgs): the regression test must pick a target for which the option genuinely changes codegen, or it codifies a *spurious* cache miss instead of the real bug. First draft used `SLANG_SPIRV` with `-Xnvrtc --gpu-architecture=` — codex/reviewer flagged it must-fix: SPIRV selects SpirvDis, so nvrtc args never reach that target's codegen; asserting the hash differs on SPIRV would lock in a false-miss the codebase deliberately avoids (cf. the `..DoesNotAffectCompilerOptionHash` test family). Switching to `SLANG_PTX` makes the nvrtc arg a genuine codegen input, so distinct hashes are correct. Still GPU-free: `getEntryPointHash` only builds the digest (it does NOT emit code); it may load the downstream compiler and query its version via `Linkage::buildHash`, but that value is identical for both links and cancels out.

Related facts (verified at source, useful for any component-option-set / cache-key work):
- `getEntryPointHash`/`buildHash` are reachable only through the C++ API — tests go in `tools/slang-unit-test/unit-test-stdin-compile.cpp` (reuse `_getOptionEntryPointHash`/`_blobContentEquals`; call the exported COM API — `linkWithOptions`, `getEntryPointHash` — so it links under `slang-unit-test`).
- `linkWithOptions` deposits caller options into the **linked component's own** `ComponentType::m_optionSet` (a different set from `Linkage::m_optionSet`), which drives codegen (`TargetProgram` ctor `overrideWith` → `getDownstreamArgs`) but was NOT in the digest.
- `Module::Module` seeds its own `m_optionSet = linkage->m_optionSet`; the `CompositeComponentType` ctor leaves it empty; `SpecializedComponentType` copies its base's via `overrideWith`. So hashing `this->getOptionSet()` in getEntryPointHash is a byte-identical **no-op only for the empty-set composite** (plain `createCompositeComponentType`→`link()`); a Module or specialized component re-keys once (harmless — deterministic, never a false hit).
