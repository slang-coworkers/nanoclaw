---
title: "slang#11982: duplicate SPIR-V DebugSource from divergent path spelling defeating hoistable-dedup"
type: learning
topic: slang-compiler
source: learnings/1783466061131-slang-11982-duplicate-spir-v-debugsource-from-dive.md
---

# slang#11982: duplicate SPIR-V DebugSource from divergent path spelling defeating hoistable-dedup

**Symptom:** importing a module + `-target spirv-asm -g2` emits TWO `DebugSource` records for the imported module's single physical file (one embedding the source text twice). Repro: `slangc tests/spirv/debug-global-variable-source-import.slang -target spirv-asm -g2 -O0` → 3 records instead of 2. Not a crash; valid SPIR-V; pure debug-info bloat. Triaged 2026-07-07, ToT 33f9ed0ce.

**Root cause (proven via `-dump-ir`, NOT by reading code):** `IRDebugSource` is `hoistable = true` (`slang-ir-insts.lua:2908`), so the IRBuilder auto-dedups insts with identical operands and link-time `cloneValue` returns the pre-existing hoistable inst (`slang-ir-clone.cpp:253`). But TWO producers in `slang-lower-to-ir.cpp` spell the filename operand differently for the SAME file, so the operands differ and dedup misses:
- Per-source-file loop `~L15302-15311`: `emitDebugSource(source->getPathInfo().getMostUniqueIdentity()...)` → **relative** spelling.
- Lazy `getOrEmitDebugSource` `~L9536-9537`: `pathInfo.getName()` → **absolute** spelling.
`getName()` vs `getMostUniqueIdentity()` both return `foundPath` for FoundPath/FromString but DIVERGE for `PathInfo::Type::Normal` (`getMostUniqueIdentity`→`uniqueIdentity`, `getName`→`foundPath`) — `slang-source-loc.cpp:17-45`. Emit (`slang-emit-spirv.cpp:2136`) does NO dedup → one `OpDebugSource` per inst → the duplicate survives. The absolute-path record is the one referenced by `DebugCompilationUnit`; the relative one is an orphan.

**Fix direction:** unify the filename spelling across both producers (Approach A) so the existing hoistable-dedup collapses them; keep the CU-referenced spelling so only the orphan is removed. General lesson: for a `hoistable=true` IR inst, two producers MUST construct identical operands or dedup silently fails — a string/path operand is a classic divergence point.

**Meta-lesson (important):** DeepWiki CONFIDENTLY asserted the dedup context is shared and relative-vs-absolute WOULD dedup — flat wrong, contradicted by the IR dump. DeepWiki reasons from symbol names, not runtime. For "does dedup actually happen" questions, `-dump-ir` is authoritative; treat DeepWiki as a lead, not proof.

Adjacent (NOT a dup): #11983 imported `DebugFunction` uses wrong compilation unit (same reporter/subsystem). Prior family fixes: #9520, #9114. See [[slang -g2 spirv-asm FileCheck tests: embedded-source self-match trap]] for testing this without tripping self-match.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1783466061131-slang-11982-duplicate-spir-v-debugsource-from-dive.md`_
