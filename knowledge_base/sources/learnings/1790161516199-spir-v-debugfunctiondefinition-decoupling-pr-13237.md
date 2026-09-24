---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790157082105-ewg6au
written_at: 2026-09-23T11:05:16.199Z
---

# SPIR-V DebugFunctionDefinition decoupling (PR #13237) — a per-spvFunc uniqueness guard misses shared IRDebugFunction across autodiff-cloned funcs

Reviewing PR #13237 (fix for #13235: emit `DebugFunctionDefinition` on the `emitDebugFunction` record-cache-hit path). The fix keys a `HashSet<SpvInst*> m_debugFunctionDefinitionsEmitted` on `spvFunc` to guarantee "≤1 definition per OpFunction body." That enforces one NonSemantic invariant but NOT the separate one: a single `DebugFunction` record must bind to exactly one body.

Verified mechanism (manifestation NOT verified — needs a build + spirv-val, which I lacked): multiple distinct `IRFunc`s can share ONE `IRDebugFunction` global inst. `copyDebugInfo` (slang-ir-autodiff.cpp:1366) clones `kIROp_DebugFuncDecoration` via `cloneDecoration`; `findCloneForOperand` (slang-ir-clone.cpp:48) returns an unmapped GLOBAL operand unchanged, so the cloned decoration points at the SAME `IRDebugFunction`. Reverse autodiff does this for applyFunc/propagateFunc/rematFuncResult from one targetFunc (slang-ir-autodiff-rev.cpp:~409). At `-g2` the record cache `m_mapIRInstToSpvInst` is keyed by that shared `IRDebugFunction` (slang-emit-spirv.cpp:10682, key at :4327-4330); each of the 4 bodies then emits its own `DebugFunctionDefinition` referencing the ONE record. Neither the per-`spvFunc` set nor a `!containsKey(irFunc)` registration guard prevents it (distinct funcs, distinct spvFuncs). Likely root cause is producer-side (autodiff sharing one debug-function record across distinct generated functions), consistent with the recurring "SPIR-V debug-info bugs → suspect the producer" theme.

PROCESS LESSON (the bigger one): all three PR reviewers (correctness/Devin/clarity) AND my own read missed this; the codex critique gate caught it. A reviewer's verdict/`[Resolution]` sign-off should pass the critique gate (mcp__codex__codex) BEFORE delivery — a `[GATE AUDIT] … gate skipped` warning means you signed off without the second opinion. When the critique returns `revise` after you already delivered, correct the record with the requester honestly rather than defending the premature claim; and never game the gate into `approve` on a sign-off that genuinely warrants revision.
