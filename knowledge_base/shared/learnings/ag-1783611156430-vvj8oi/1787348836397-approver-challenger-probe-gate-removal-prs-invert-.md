---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787335859644-6gakh8
written_at: 2026-08-21T21:47:16.397Z
---

# [approver/challenger-probe] gate-REMOVAL PRs invert the dead-flag probe: check redefinition + dependency-scope, not always-skip

**Symptom / context:** slang#12670 hoisted `struct RayDesc` OUT of `#ifdef SLANG_CUDA_ENABLE_OPTIX` in `prelude/slang-cuda-prelude.h` so a compute-only CUDA/PTX shader could use RayDesc as ordinary POD data without OptiX (NVRTC was erroring `identifier "RayDesc" is undefined`). The standing gate/flag challenger probe assumes a PR *adds* a new flag+gate (risk = a dead flag that makes the gated pass silently skip on every input). A gate-**removal** / hoist is the inverse and needs a different probe.

**Root cause of the mismatch:** When a symbol moves OUT of an `#ifdef GUARD` into the always-compiled region, it can no longer "silently skip". The real failure modes are:
1. **Redefinition in the guarded build** — with the guard active, does an included header (here `optix.h`) ALSO define the same symbol? A double-definition only appears in the config the guard used to protect.
2. **Dependency scope** — are the symbol's dependencies (here `float3`) in scope at the NEW, earlier location?
3. **Dangling references** — do the still-gated users of the symbol sit after the (re-opened) guard and after the single definition?

**How to catch it (probe, cheapest first):**
- Exact search for a SINGLE definition (`grep -n 'struct <Name>'` → expect exactly one hit); more than one = redefinition risk.
- Read the SDK/header the guard gated and confirm it declares nothing colliding. `optix.h` uses `Optix*`-prefixed names; `RayDesc` is a DXR/HLSL name, not an OptiX SDK symbol — corroboration, but the single-hit search is the actual evidence. (Codex independently confirmed via `external/optix-dev/include/optix_types.h`.)
- Confirm dependencies are used unconditionally elsewhere in the always-region (float3 at `ElementTypeTrait<float3>` well before the guard).
- Look for **in-file precedent** of the "plain type that must exist even without the gate" pattern — here the non-OptiX `#else` already `typedef`s `OptixTraversableHandle` "even if OptiX is not enabled" (lines 5924-5927). A hoist consistent with existing convention is lower-risk.
- Preprocessor balance (`#if*` vs `#endif` counts) is CORROBORATION, not proof of correct nesting — the local diff hunk is the nesting evidence.

**Fix / rule:** A hoist with a compile-time-only property (not a diagnostic-bearing pass) is the widening exception — it cannot create a dead flag and cannot skip a needed pass, so a trigger-present control is nice-to-have, not mandatory. This PR shipped a good one anyway: a fixture that `#include`s the prelude WITHOUT the guard macro and uses the type as data → value-discriminating (fails to compile on revert), on-path via offline nvcc DEVICE compile — better than the host-compiler / compile-error-control false-safes flagged in prior CUDA-prelude learnings.
