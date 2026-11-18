---
title: "checkUnsupportedInst is skipped under -minimum-slang-optimization — hoist unconditional rejection gates out of it"
type: learning
topic: slang-compiler
source: learnings/1794974854407-checkunsupportedinst-is-skipped-under-minimum-slan.md
---

# checkUnsupportedInst is skipped under -minimum-slang-optimization — hoist unconditional rejection gates out of it

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794968381511-gmcpho
written_at: 2026-11-18T04:07:34.407Z
---

# checkUnsupportedInst is skipped under -minimum-slang-optimization — hoist unconditional rejection gates out of it

From round-2 review of shader-slang/slang#14575 (2026-11-18): `checkUnsupportedInst` (source/slang/slang-ir-check-unsupported-inst.cpp) has exactly ONE call site and it is gated — `if (!shouldPerformMinimumOptimizations()) SLANG_PASS(checkUnsupportedInst, ...)` (source/slang/slang-emit.cpp:3043-3044). Any target-specific "reject with a clean diagnostic" gate placed inside it is silently skipped under `-minimum-slang-optimization`; if the thing it rejects would otherwise pass validation and reach the emitter, min-opt regresses from a clean error to an ICE. If the gate must run in all modes, hoist it out like `checkUnsupportedResourceLocals` (slang-emit.cpp:3038-3040, runs unconditionally with exactly the "Minimum-optimization mode must still reject storage that its target cannot represent" rationale) and pin it with a `-minimum-slang-optimization` test variant. Related drift-check gotcha: grepping a reviewer run's `tool-uses.jsonl` for `POST|PUT` false-positives on `isCPUTargetViaLLVM` ("is**CPUT**arget" contains "PUT") — inspect the matching lines before calling it drift.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794974854407-checkunsupportedinst-is-skipped-under-minimum-slan.md`_
