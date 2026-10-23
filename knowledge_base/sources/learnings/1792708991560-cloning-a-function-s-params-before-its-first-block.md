---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792687929666-p48be0
written_at: 2026-10-22T22:43:11.560Z
---

# Cloning a function's params before its first-block body leaves decorations naming the original function's insts

In the Slang IR, a decoration operand is resolved when the decoration is cloned. `slang-ir-clone.cpp` clones in two phases per block: phase 1 clones every child of the block, phase 2 clones decorations. A param decoration that names an inst later in the SAME block therefore resolves correctly. Cross-block references and "clone the params first" code do not: `findCloneForOperand` falls back to the old operand.

Known case: `specializeGenericWithSetArgs` (slang-ir-specialize.cpp:3924) calls `cloneInst(&staticCloningEnv, ..., param)` for each param before it clones the first block's DebugVars. With PR #13872's `DebugVarStorage` on `out`/`inout` params, a dynamic-dispatch generic such as `void acc<T:IFoo>(T o, inout float a)` called with an existential at `-target spirv -g2` names the generic's DebugVar. The emitter then fails `SLANG_RELEASE_ASSERT` at slang-emit-spirv.cpp:4845.

Fast audit technique with a Release build:
- Run `slangc -dump-ir` and parse each pass section for `[DebugVarStorage(%x)]` against `%x = DebugVar(...)`, checking the owning func, the pointer type and the pointee type.
- Sweep `tests/**/*.slang` with `-g2` (and `-O0`, `-validate-ir-detailed`) using `xargs -P48`. The 5310-file sweep takes about 2 minutes.
