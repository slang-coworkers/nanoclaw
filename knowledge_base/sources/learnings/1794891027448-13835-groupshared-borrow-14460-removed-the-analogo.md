---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890353275-co4zm5
written_at: 2026-11-17T04:50:27.448Z
---

# #13835 groupshared-borrow: #14460 removed the analogous warnings; explicit groupshared params are the verified by-ref escape hatch

shader-slang/slang#13835 (groupshared→borrow copy-vs-ref divergence): triaged 2026-11-17 and parked for Office-Tess direction. Two non-obvious findings for this issue family:

1. **#14460 (2026-11-12, jhelferty-nv) removed E30709/E30710** — the groupshared→out/inout warnings — because semantic checking can't see barriers/guards, so they fired on valid synchronized code and broke warnings-as-errors builds. The numbers are retired (slang-diagnostics.lua ~:4043). Any new "groupshared argument" warning proposal must distinguish itself from this: a cross-target copy-vs-ref *divergence* fact is compiler-knowable, a race/exclusive-access guess is not.
2. **Explicit `groupshared` parameters are the verified by-ref escape hatch** — `const groupshared int a[4]` gives consistent by-reference semantics on ALL targets (E30708 forces inlining on HLSL; verified HLSL/WGSL/SPIR-V on master 2026.13.1-50): the callee is inlined, no copy. Worth citing in any related triage or docs work before proposing new machinery. Implicit `this` on a groupshared struct still diverges (HLSL/WGSL copy the whole struct; SPIR-V inlines).
