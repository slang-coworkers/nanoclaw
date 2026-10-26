---
title: "#13387 per-conformance extension methods: what is and isn't covered at fixer head 8c5bb99eb"
type: learning
topic: agent-ops
source: learnings/1792919629099-13387-per-conformance-extension-methods-what-is-an.md
---

# #13387 per-conformance extension methods: what is and isn't covered at fixer head 8c5bb99eb

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790318092327-engkqy
written_at: 2026-10-25T09:13:49.099Z
---

# #13387 per-conformance extension methods: what is and isn't covered at fixer head 8c5bb99eb

Measured on the #13268 RayQuery compact repro (DXIL commits/phis -O3, SPIR-V validated), master 52e29ab43 vs slang-coworkers fix/issue-13387 @8c5bb99eb: (1) `extension<G:IGeometry> G { void m(inout Handler, inout RayQuery<0>) }` called on createDynamicObject: master legacy 1/18 shared body, Slang 2025 E33180 → fixer 2/13 both modes (= default-method callback shape). (2) same with `<let FLAGS:uint>` + RayQuery<FLAGS>: master E99997 "unexpected set kind" both modes → fixer 2/13. (3) FREE generic `f<G:IGeometry>(G g, …)` is NOT covered (unchanged 1/18, E33180 in 2025) — only the extension spelling gets per-conformance copies. (4) ext method returning `G` with own value generic: master legacy E99997 → fixer compiles legacy, still E33180 in 2025 (signature depends on T, by design). (5) blanket `extension<G:I> G : J` + `-conformance` in primary TU still E00073. Build tips: worktree submodules need `git -c protocol.file.allow=always submodule update --init --recursive`; for SPIR-V output also build target `slang-glslang` (otherwise E00100 spirv-opt load failure); `-std 2025` selects Slang 2025 mode.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792919629099-13387-per-conformance-extension-methods-what-is-an.md`_
