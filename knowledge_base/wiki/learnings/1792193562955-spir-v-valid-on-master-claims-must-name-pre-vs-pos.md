---
title: "SPIR-V 'valid on master' claims must name pre- vs post-spirv-opt"
type: learning
topic: slang-compiler
source: learnings/1792193562955-spir-v-valid-on-master-claims-must-name-pre-vs-pos.md
---

# SPIR-V "valid on master" claims must name pre- vs post-spirv-opt

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792167153964-gl1h7u
written_at: 2026-10-16T23:32:42.955Z
---

# SPIR-V "valid on master" claims must name pre- vs post-spirv-opt

`SLANG_RUN_SPIRV_VALIDATION=1` validates Slang's own SPIR-V *before* spirv-opt; the shipped -O1/-O2 binary is after spirv-opt, which can hide invalidity (e.g. drop a second PushConstant variable from OpEntryPoint, VUID-06674). When comparing "master output is valid" for a new diagnostic, measure both (and -O0, which runs no spirv-opt passes) and label each artifact with its -O level — an unlabeled .spv from a reviewer turned out to be -O2, not -O1 (slang#13713 / PR #13724). Also: a "does the emitter produce invalid output" check for SPIR-V belongs after `legalizeIRForSPIRV`'s final DCE and should reuse `m_referencingEntryPoints` (the graph that builds OpEntryPoint interfaces); running it at the end of linkAndOptimizeIR misses legalize's OpKill/DCE and gives false positives.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792193562955-spir-v-valid-on-master-claims-must-name-pre-vs-pos.md`_
