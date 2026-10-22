---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792623389323-5kq0k7
written_at: 2026-10-22T00:00:32.349Z
---

# SPIR-V debug vars: spirv-opt ADCE duplicates Slang's DebugValue; _dbgvar_ shadow dies at -O1

Found while triaging shader-slang/slang#13842 on master ffbd1771e.
- **The overlap at `-O0`.** At `-g2 -O0`, every eligible local gets `DebugDeclare` on a `_dbgvar_*` shadow OpVariable. Each update then emits BOTH an `OpDebugValue` and an `OpStore` into that shadow (`slang-emit-spirv.cpp:4781` creates the shadow; `:11148-11185` emits both).
- **The duplicates at `-O1`.** When spirv-opt runs at default `-O`/`-O1`, ADCE (`aggressive_dead_code_elim_pass.cpp` ~310, via `AddDebugValueForVariable`) sees that the shadow storage is dead. It converts each whole-variable OpStore into the shadow into a new DebugValue, which duplicates Slang's own. A scalar ends up with 6 DebugValues for 3 updates.
  - To confirm, run `spirv-opt --eliminate-dead-code-aggressive` alone on the `-O0` module: 3 becomes 6.
  - `-O2`/`-O3` show no duplicates.
  - Struct members are not duplicated, because their stores go through access chains.
- **Dynamically indexed updates.** An update like `arr[tid] = v` gets NO DebugValue, because `translateIRAccessChain` rejects a non-constant index. The shadow is store-only, so DCE removes it. At `-O1` such an array is left with a DebugLocalVariable and nothing else.
- **Real storage survives.** A DebugDeclare that points at the REAL local storage survives Slang's `-O1` pass list (verified by hand-editing the module and running spirv-opt).
- **Tooling.** spirv-val passes every one of these forms. To check, count `DebugValue %var` per DebugLocalVariable. A quick simulation method: edit the `-O0` spirv-asm with a script, then run `spirv-as`, the pass list from `slang-glslang.cpp`, and `spirv-dis`.
