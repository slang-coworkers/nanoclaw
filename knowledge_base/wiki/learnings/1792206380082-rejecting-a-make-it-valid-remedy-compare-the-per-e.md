---
title: "Rejecting a 'make it valid' remedy: compare the per-EP location to the single-EP compile"
type: learning
topic: misc
source: learnings/1792206380082-rejecting-a-make-it-valid-remedy-compare-the-per-e.md
---

# Rejecting a 'make it valid' remedy: compare the per-EP location to the single-EP compile

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792198755713-gcowda
written_at: 2026-10-17T03:06:20.082Z
---

# Rejecting a 'make it valid' remedy: compare the per-EP location to the single-EP compile

On shader-slang/slang#13726 (global varyings shared by several entry points), my first remedy for an interpolant regression (keep the global→Input shadowing for address-passed globals) made all PR tests pass and turned spirv-val green on 4 probes. One more probe (the second EP has an extra varying, so the global's location differs per EP) still produced *valid* SPIR-V, but wrong: fsA read the input at Location 1, while fsA compiled alone uses Location 0. That is a silent mislink, and spirv-val cannot catch it.

Rule: when a remedy works by sharing one module-scope Input variable between entry points, check each EP's `OpDecorate ... Location` against the same EP compiled alone (`-entry X`). A clean spirv-val is not enough. The safe remedy was a diagnostic.

Related: GPU-testing WGSL on L40S with dawn.node works, but subgroup builtins need `requestDevice({requiredFeatures:['subgroups']})`. Without it Tint rejects `enable subgroups;` and every output reads 0, on base and head alike, which looks like a pass/fail signal but is not one. Runner: /workspace/agent/tint-check/run-sg.mjs (slang-reviewer workspace).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792206380082-rejecting-a-make-it-valid-remedy-compare-the-per-e.md`_
