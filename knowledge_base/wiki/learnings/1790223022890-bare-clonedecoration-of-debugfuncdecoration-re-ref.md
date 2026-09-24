---
title: "Bare cloneDecoration of DebugFuncDecoration re-references (not deep-copies) the IRDebugFunction — same shared-record shape at multiple producers"
type: learning
topic: misc
source: learnings/1790223022890-bare-clonedecoration-of-debugfuncdecoration-re-ref.md
---

# Bare cloneDecoration of DebugFuncDecoration re-references (not deep-copies) the IRDebugFunction — same shared-record shape at multiple producers

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790222417930-a53y5o
written_at: 2026-09-24T04:10:22.890Z
---

# Bare cloneDecoration of DebugFuncDecoration re-references (not deep-copies) the IRDebugFunction — same shared-record shape at multiple producers

In Slang, `cloneDecoration(&cloneEnv, decor, newFunc, ...)` with an **empty** clone environment reproduces a `DebugFuncDecoration` but leaves its operand — the `IRDebugFunction` record — as a **shared reference, not a deep copy** (`findCloneForOperand` returns the original operand for anything not in the env). So the new function ends up pointing at the *original* function's `IRDebugFunction`.

This exact producer-side shape appears in at least two places:
- **Autodiff** `copyDebugInfo` (`slang-ir-autodiff.cpp`) → #13238 / PR #13239 (derivatives shared the original's record).
- **Out-parameter lowering** `transferFunctionDecorations` (`slang-ir-lower-out-parameters.cpp:387-389`) → filed #13251 (sibling; latent).

Whether it's a **live bug** depends on whether the old function *survives*: if the pass removes/replaces the original (only one live function references the record) the sharing is transient/harmless; if both functions stay alive (e.g. out-param lowering's `handleOriginalFunction` keeps the original when `useCount>1`, which happens when hoisted `uniform` params carry `IREntryPointParamDecoration`s referencing it) you get two live functions sharing one record → misleading debug names + a dropped `DebugFunctionDefinition` (SPIR-V `emitDebugFunction` caches per-`IRDebugFunction` inst and dedups the definition per record).

Second, separable defect in the out-param case: the replacement wrapper has a **different signature** but inherits the original's record → **stale debug type**.

In-tree fix precedent: `fixUpDebugFuncType(newFunc)` (`slang-ir.cpp:854-884`) mints a fresh `IRDebugFunction` and refreshes the type — but today it's only called from specialization (`slang-ir-specialize.cpp:2600`). Calling it after a decoration transfer both breaks the sharing and fixes the stale type, while keeping the source name (correct when the wrapper is the same source function ABI-rewritten, vs an autodiff derivative which is a genuinely different function and should get its own name). Triage tip: when you see a bare `cloneDecoration` of a debug/identity decoration onto a new function, ask "does the old function survive?" and "does the new function's signature match the record?" before calling it benign.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790223022890-bare-clonedecoration-of-debugfuncdecoration-re-ref.md`_
