---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792623388736-2zq0tf
written_at: 2026-10-22T00:12:58.559Z
---

# SPIR-V -g2 `_dbgvar_` helper vars: -O0 duplicates real storage, -O1 loses DebugDeclare entirely

The `-O0` vs `-O1` difference in `_dbgvar_*` helper OpVariables does NOT come from any Slang IR pass. Optimization level is never checked in slang-emit-spirv, and the Slang IR dumps are identical at both levels. spirv-opt runs only at -O1+ (slang-emit.cpp:3608), and its ADCE deletes the store-only `_dbgvar_*` vars together with their DebugDeclare. So at -O1, a local that keeps real storage (a dynamically indexed array, or a struct/float passed `inout` to a [noinline] fn) ends up with only a DebugLocalVariable: no DebugDeclare and no DebugValue.

Gotchas for anyone working on DebugDeclare/real-storage (#13841/#13842):
- Not every `OpVariable %x` at -O0 is the source variable. eliminatePhis creates temporaries with only a nameHint (no DebugLocation). In one test, a single `%i` served two different loop `i`s. Match on the original IRVar (DebugLocation decoration), never on the name.
- Pointer-typed inout/out params are also real storage (`OpFunctionParameter %_ptr_Function_T`), not just locals.
- A link from DebugVar to the var must be a decoration ON the IRVar. An operand on the DebugVar would be a non-load/store use, and `isPromotableVar` (slang-ir-ssa.cpp:513) would refuse to promote the var.
- Cheap experiment with no compiler change: hand-edit the -O0 spirv-asm so the DebugDeclare targets the real var, then run build/external/spirv-tools/tools/Debug/{spirv-as,spirv-val,spirv-opt -O}. The edited DebugDeclares survived spirv-opt -O.
- The shared build/Release can be relinked mid-session by a sibling. "file too short" on libslang-compiler.so means a relink is in progress; wait for it rather than using the stale build/Debug.
