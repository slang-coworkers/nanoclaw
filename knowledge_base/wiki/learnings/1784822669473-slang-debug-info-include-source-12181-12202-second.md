---
title: "Slang -debug-info-include-source (#12181/#12202): second IRDebugSource producer + LLVM target-agnostic gaps"
type: learning
topic: slang-compiler
source: learnings/1784822669473-slang-debug-info-include-source-12181-12202-second.md
---

# Slang -debug-info-include-source (#12181/#12202): second IRDebugSource producer + LLVM target-agnostic gaps

Reviewing PR #12202 (new `-debug-info-include-source` CLI flag, embeds shader source into SPIR-V core `OpSource` at `-g1` independently of `-g`), the 3-reviewer pipeline surfaced findings the SINGLE most-scoped reviewer (Devin) missed entirely — Devin returned 0/0/0 clean, but Reviewer A (correctness) found 1 bug + 5 gaps and clarity found 11 candidates. Two A-only findings are the durable lesson for anyone touching SPIR-V debug-source emission:

1. **There are TWO `IRDebugSource` producers.** The per-source-file loop in `slang-lower-to-ir.cpp` (~15428/15434) is the obvious one, but `getOrEmitDebugSource` (~9717) is a SECOND, per-location producer that the entry point's `IRDebugLocationDecoration` ultimately points at. A change that widens content-embedding at `-g1` in ONE producer but not the other means `emitCoreOpSource` (which picks `m_defaultDebugSource` = the entry point's source) can emit `OpSource` with a `File` operand but an EMPTY `Source` operand whenever the entry point's resolved `SourceFile*` differs from the one the file-loop cached (path-identity mismatch, or entry point reached through an imported module). Fix: thread the same `shouldIncludeSourceInDebugInfo()` condition into BOTH producers, or make the consumer treat empty-content `m_defaultDebugSource` as "not found" and continue to its module-scan fallback.

2. **The producer ternary is target-agnostic — it runs for ALL targets.** A SPIR-V-only-documented flag whose producer change isn't SPIR-V-gated silently reaches the LLVM backend: `slang-emit-llvm.cpp` reads `IRDebugSource::getSource()` into LLVM `DIFile` gated only on `debugInfoLevel != None` (~2463), so `-target llvm -g1 -debug-info-include-source` embeds full source where `-target llvm -g1` alone would not. Other non-SPIRV targets accept the flag and do nothing with NO warning — this diverges from the established `-separate-debug-info` precedent, which emits `SeparateDebugInfoUnsupportedForTarget` per non-SPIRV raw target (`slang-options.cpp` ~4846-4874). Principled fix: gate the producer override on a SPIRV target and/or add a symmetric `...IgnoredForTarget` warning.

Meta-lesson: for SPIR-V debug-info features, always check (a) is there a second producer of the IR inst you're modifying? and (b) is your producer-side change target-scoped to match where it's documented to apply?

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784822669473-slang-debug-info-include-source-12181-12202-second.md`_
