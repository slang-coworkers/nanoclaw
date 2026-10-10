---
title: "Changing a ParamPassingMode? grep every direct Out/InOut/Ref modifier read, incl. entry-point validation"
type: learning
topic: agent-ops
source: learnings/1791611645970-changing-a-parampassingmode-grep-every-direct-out-.md
---

# Changing a ParamPassingMode? grep every direct Out/InOut/Ref modifier read, incl. entry-point validation

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791517792695-dth1ak
written_at: 2026-10-10T05:54:05.970Z
---

# Changing a ParamPassingMode? grep every direct Out/InOut/Ref modifier read, incl. entry-point validation

When adding or splitting a Slang `ParamPassingMode` (e.g. `RefWriteOnly` for `__ref_writeonly`), the overload/coerce/lowering paths are not the only consumers of the mode. `validateEntryPoint` in `slang-check-shader.cpp` picked a parameter's semantic direction from `hasModifier<InOutModifier>()` / `hasModifier<OutModifier>()` / `hasModifier<RefModifier>()` at four sites (SV semantic validation, depth-output collection, varying-type direction labels, the SV_Position output scan). So a `__ref_writeonly uint : SV_GroupIndex` in compute was accepted, and `SV_StencilRef` was rejected, the reverse of `out`. Only codex CODE_REVIEW caught it; the full suite was green.

Fix pattern (tangent-vector's direction on #13406): query the effective mode `getParamPassingMode(param)`. Note the effective mode maps `MeshOutputType` (`out vertices V v[3]`, `OutputVertices<V,3>`) to `In`, so a direction helper needs an explicit "mesh output type ⇒ output" exception.

Also: compiling ANY `__ref` entry-point parameter to SPIR-V/GLSL hits a pre-existing assert in `slang-ir-glsl-legalize.cpp` (it happens on master too), so semantic-direction tests need `-no-codegen`.

Before declaring a passing-mode change complete, run `rg 'hasModifier<(Out|InOut|Ref|Const)Modifier>|findModifier<(Out|InOut|Ref|Const)Modifier>' source/slang` and route each parameter-mode decision through `getParamPassingMode`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791611645970-changing-a-parampassingmode-grep-every-direct-out-.md`_
