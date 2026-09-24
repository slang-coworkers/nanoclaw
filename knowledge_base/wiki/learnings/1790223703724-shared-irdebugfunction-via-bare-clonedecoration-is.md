---
title: "Shared IRDebugFunction via bare cloneDecoration is a recurring quality-only class; fix producer-side with fixUpDebugFuncType"
type: learning
topic: misc
source: learnings/1790223703724-shared-irdebugfunction-via-bare-clonedecoration-is.md
---

# Shared IRDebugFunction via bare cloneDecoration is a recurring quality-only class; fix producer-side with fixUpDebugFuncType

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790222984655-1oho1b
written_at: 2026-09-24T04:21:43.724Z
---

# Shared IRDebugFunction via bare cloneDecoration is a recurring quality-only class; fix producer-side with fixUpDebugFuncType

When an IR pass creates a replacement/derivative function and copies the original's decorations with a **bare `cloneDecoration`** (no operand remapping / empty `IRCloneEnv`), the cloned `DebugFuncDecoration`'s operand-0 `IRDebugFunction` is shared **by reference** — the new function and the original point at the SAME record. This is a recurring producer-side class, verified at shader-slang/slang master 6eb89786c:

- **Producers seen:** autodiff `copyDebugInfo` (`slang-ir-autodiff.cpp:1355-1374`, bare-clones at :1366-1368) → issue #13238; out-parameter lowering `transferFunctionDecorations` (`slang-ir-lower-out-parameters.cpp:387-390`, empty cloneEnv declared :431, runs before `createNewParameters` :485 which uses a separate `origToNewParamMap`) → issue #13251.
- **`DebugFuncDecoration` carries the record as operand-0** (`slang-ir-insts.lua:2669-2673`, `getDebugFunc()` `slang-ir-insts.h:2775`), so a bare clone shares it.

**Consequence is debug-info QUALITY, not a miscompile / not invalid SPIR-V.** The SPIR-V emitter's `emitDebugFunction` caches keyed on the `IRDebugFunction` inst (`slang-emit-spirv.cpp:10856`) AND dedups the per-body `DebugFunctionDefinition` per record (`:10836`, set `:596`; emitter comment `:10819-10822` documents exactly this reverse-mode-autodiff sharing). That dedup guard prevents *invalid two-definition* SPIR-V — so the residual is only misleading/stale debug **names + types** (matches #13238's title "misleading debug names"). Metal/C-like emitters don't consume `DebugFuncDecoration` at all (no-op skip `slang-emit-c-like.cpp:3288`/`:5347`) → the defect is **latent** whenever the sharing producer only feeds a non-SPIR-V target (e.g. out-param lowering is Metal-only via `legalizeShaderOutputParamsForMetal`).

**Producer-side fix = `fixUpDebugFuncType(IRFunc*)`** (`slang-ir.cpp:854-884`): if the func's data type differs from the record's `getDebugType()`, it mints a FRESH distinct `IRDebugFunction` (via `emitDebugFunction`, preserving name/line/col/file/scope), removes the old `DebugFuncDecoration`, adds a new one — fixing BOTH the sharing AND a stale debug type in one call. It early-returns when the type is unchanged. Sole existing caller today is specialization (`slang-ir-specialize.cpp:2600`); the natural fix for a new producer is to call it right after the decoration copy (a changed wrapper signature guarantees it fires). Alternative: exclude `DebugFuncDecoration` from the clone loop and build a fresh record (PR #13239's approach for the autodiff sibling).

**Triage takeaways:** (1) a shared-`IRDebugFunction` report is debug-info quality (low/P3, latent if the producer isn't wired to SPIR-V), never a miscompile — don't over-severity it; (2) don't apply `reproduced` when there's no wired SPIR-V path — it's confirmable by source trace only; (3) the fix belongs producer-side (`fixUpDebugFuncType`), not in the emitter. Cluster: #13235 (emit-consumer, MERGED PR #13237) / #13238 (autodiff producer, draft PR #13239) / #13251 (out-param-lowering producer).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790223703724-shared-irdebugfunction-via-bare-clonedecoration-is.md`_
