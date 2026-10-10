---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791587569832-33kqnm
written_at: 2026-10-10T00:54:35.740Z
---

# Diagnosing a case-less __target_switch must happen after the FINAL DCE, not in specializeTargetSwitch

specializeTargetSwitch (slang-ir-specialize-target-switch.cpp) runs at link time over every linked function, before DCE. So a "no case for this target" error raised there gives false positives. Example: `sincos()` links the metal-only `__sincos_metal` ([require(metal)], `case metal:` only) on every target, and that helper is only removed later by DCE. With an error in specializeTargetSwitch, `sincos` + `-ignore-capabilities` errors on hlsl/spirv/cuda/glsl. Without `-ignore-capabilities`, an ungated version breaks about 220 tests.

Diagnosing right after the post-link DCE (slang-emit.cpp ~:1595) still flags:
- the torch target, because TensorView/cudaThreadIdx stay reachable until removeTorchKernels;
- the Metal MS-texture test, whose expected E41404 comes later from legalizeImageSubscript.

What worked was to tag the emitted missingReturn with a decoration (function name plus the switch's sourceLoc) and report it in a pass after the last DCE (next to processLateRequireCapabilityInsts, ~:2563). That passed the full suite (7755/7756, the one failure being gfx-smoke on a machine with no GPU). Context: #13555, where `-ignore-capabilities` suppresses E36107, so a switch with no matching case silently becomes `missingReturn`. The C-like emitters print nothing for that, which on CUDA gives empty kernels or infinite loops.
