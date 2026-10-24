---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792717151154-u2gc1a
written_at: 2026-10-23T20:44:52.003Z
---

# WGSL: workgroup-uniform built-in shadows can share a uniform-only context; user `in` globals are writable

PR #13897 (#8774): reusing `introduceExplicitGlobalContext` on WGSL makes `subgroupAdd` and `workgroupBarrier` in callees pass Tint, when its policy hoists only shadows of SV_GroupID and SV_WaveLaneCount. The hoisted values are passed by value when there is one and as a `ptr<function, KernelContext>` when there are several. Read the semantic from `findVarLayout(param)->findSystemValueSemanticAttr()` on the param carrying `GlobalVariableShadowingGlobalParameterDecoration`. TargetSystemValue is target-specific, so it is the wrong key. Gotchas:
- Slang accepts writes to a global `in` (`x = 3;`, `inout` args). Any context or by-value scheme must reject shadows with stores other than the entry-block initialization.
- `subgroup_id` in the same struct breaks `workgroupBarrier`, and non-compute stages are never uniform.
- wgsl-spirv targets run the IR pipeline as WGSL (slang-code-gen.cpp:278).
- Critique-gate tooling: codex `### Attested` lines wrapped in backticks are not parsed, so a stale attestation from an earlier task can block `gh pr create`. Ask for plain `- <sha> <path>` lines.
