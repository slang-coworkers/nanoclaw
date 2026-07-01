---
title: "slang-emit-spirv-extra-memoryaccess-word-grammar-bug-pattern"
type: learning
topic: slang-compiler
source: learnings/1779617068760-slang-emit-spirv-extra-memoryaccess-word-grammar-b.md
---

# slang-emit-spirv-extra-memoryaccess-word-grammar-bug-pattern

# `emitOperand(extraMask)` after a user-supplied MemoryAccess word emits invalid SPIR-V

**The bug shape** — When injecting a memory-access mask (e.g. `Volatile`, `Coherent`) into a SPIR-V `OpLoad`/`OpStore` that may already carry a user-supplied mask, calling `emitOperand(uint32_t(extraMask))` AFTER the user's word produces TWO consecutive MemoryAccess words. SPIR-V `OpLoad` accepts at most ONE MemoryAccess bitmask operand; consecutive words violate the instruction grammar and `spirv-val` rejects.

**Reachable when** the user authors a `spirv_asm` block with a memory-access operand against a flagged builtin, e.g.:
```
spirv_asm { result:$$uint = OpLoad builtin(SubgroupLocalInvocationId:uint) Aligned 4 }
```
under `-capability vk_mem_model` in a raytracing stage. The current `hlsl.meta.slang` intrinsics don't carry memory operands on these builtins, so today's stdlib doesn't trigger it — bug is latent for hand-written user code only.

**Why the operand-scan short-circuit is also incomplete** — Code that scans existing operands for an already-supplied mask typically inspects only `kIROp_SPIRVAsmOperandLiteral`. Slang lowers symbolic mask names (`NonPrivatePointer`, `MakePointerVisible`, etc.) to `kIROp_SPIRVAsmOperandEnum`, which carries the integer value at `operand->getOperand(0)` exactly the same as Literals. Without including Enum operands, the scan reports "user supplied no mask" even when they did.

**Where this pattern lives in the codebase (Dec 2026):**
- New copy: `source/slang/slang-emit-spirv.cpp:11371-11382` (introduced in PR #11265 for raytracing Volatile injection).
- Pre-existing copy: the `needToUseCoherentLoadOrStore` path (same file) — same `emitOperand(requiredMask)` after operand emission. Same bug class.

**Correct shape:**
1. Pre-compute a single combined mask: `usedMask |= injectedMask`.
2. Accept BOTH `kIROp_SPIRVAsmOperandLiteral` AND `kIROp_SPIRVAsmOperandEnum` in the scan.
3. Either (a) suppress the user's original mask emission and emit the merged value as the single MemoryAccess word, OR (b) when no user mask is present, emit just the injected mask. Never emit two adjacent words.

**Apply when:**
- Reviewing or writing new memory-operand injection paths in `slang-emit-spirv.cpp`.
- Auditing `emitSPIRVAsm` and similar branches that copy from `needToUseCoherentLoadOrStore`.
- Writing tests: a test that validates output via `SLANG_RUN_SPIRV_VALIDATION=1` and includes a `spirv_asm` block with a non-Volatile mask against a flagged builtin will catch this; FileCheck-only tests will not.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779617068760-slang-emit-spirv-extra-memoryaccess-word-grammar-b.md`_
