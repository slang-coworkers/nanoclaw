---
title: "slang-emit-spirv builtin-var cache and the volatile-set cache-hit trap"
type: learning
topic: slang-compiler
source: learnings/1779612967874-slang-emit-spirv-builtin-var-cache-and-the-volatil.md
---

# slang-emit-spirv builtin-var cache and the volatile-set cache-hit trap

# slang-emit-spirv builtin-var cache and the volatile-set cache-hit trap

When you add an IR-side flag set that's populated *inside* `getBuiltinGlobalVar` (e.g. `m_volatileBuiltinGlobalVars` for #10528), populate it BEFORE the cache-hit early return — not after the variable creation block. Otherwise the second IR call site that hits the cache misses the set, and downstream consumers keyed by IR pointer (`getMemoryAccessOperandsOfLoadStore`, `emitSPIRVAsm` injection) silently skip that alias.

```cpp
// In getBuiltinGlobalVar:
auto key = BuiltinSpvVarKey(...);
if (isVolatile)                                  //  ← BEFORE the cache check
    m_volatileBuiltinGlobalVars.add(irInst);
if (m_builtinGlobalVars.tryGetValue(key, result))
    return result;
// ... only the cache-miss path falls through to var creation ...
```

**Why this matters for #10528-shaped fixes.** `WaveGetLaneIndex` etc. in `hlsl.meta.slang` are `[ForceInline]` and lower through `spirv_asm { result = OpLoad builtin(SubgroupLocalInvocationId:uint) }`. After inlining, two raygen call sites in the same shader produce two distinct `kIROp_SPIRVAsmOperandBuiltinVar` IR insts. They share a cache key (same `builtinName`, `storageClass`, `flat`, `pointeeType`, `isVolatile`), so the second `getBuiltinGlobalVar` call hits the cache. The set is keyed by the IR inst, so the consumer (`m_volatileBuiltinGlobalVars.contains(ptrOperand)`) returns false for the second alias under vk_mem_model, and that load is emitted with no `Volatile` mask. Validator may not flag this, but the runtime hazard the spec warns about (stale subgroup state across invocation-repack) is real.

**Tests must exercise this.** A single-call-site test passes the flag for the first IR inst (which always populates regardless of where the `.add()` lives) and won't catch the bug. Use a helper-function call alongside a direct call to force two distinct IR call sites — the helper's body inlines into a separate spirv_asm block.

**Same shape exists for `flat` and other axes.** The `BuiltinSpvVarKey` cache uses `flat` and `pointeeType` already; if you ever add a side-table keyed by IR call-site for those, the same pre-cache `.add()` rule applies.

**Adjacent gotcha — spirv_asm bypasses `emitLoad`.** `getMemoryAccessOperandsOfLoadStore` only runs for regular `IRLoad`/`IRStore`. Builtin loads from `OpLoad builtin(...)` inside `spirv_asm` blocks (which is how all the wave / subgroup / SM / RayTmax intrinsics in `hlsl.meta.slang` reach SPIR-V) go through `emitSPIRVAsm` and emit verbatim. Adding behavior to `getMemoryAccessOperandsOfLoadStore` for a flag tied to builtin operands will appear to work in unit-style tests that route through the regular path, but will be a dead branch for the actual end-user bug. Extend `emitSPIRVAsm` too: detect the `case SpvOpLoad:` branch, call `ensureInst(ptrOperand)` to materialize the builtin (which populates the set), then inject the memory operand after the operand-emit loop. Watch for user-supplied literal masks via the `usedMask` scan to avoid double emission.

Found while fixing shader-slang/slang#10528. Codex critique caught the cache-hit miss; the spirv_asm bypass surfaced when tracing why the vk-mem-model test wouldn't see the mask on a `WaveGetLaneIndex` load.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1779612967874-slang-emit-spirv-builtin-var-cache-and-the-volatil.md`_
