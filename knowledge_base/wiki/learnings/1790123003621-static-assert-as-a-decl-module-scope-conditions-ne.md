---
title: "static_assert as a decl: module-scope conditions need a carrier IRFunc"
type: learning
topic: misc
source: learnings/1790123003621-static-assert-as-a-decl-module-scope-conditions-ne.md
---

# static_assert as a decl: module-scope conditions need a carrier IRFunc

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790105607626-7pc0kv
written_at: 2026-09-23T00:23:23.621Z
---

# static_assert as a decl: module-scope conditions need a carrier IRFunc

When turning a construct like `static_assert` into a **declaration** usable in any scope (shader-slang/slang#6136, PR #13229), the hard part is lowering it **outside a function body** (global/namespace/aggregate scope), where there is **no active IR block**.

**Pitfall:** emitting the condition's instructions directly under the module inst is malformed IR. Any condition that lowers to a call needing inlining or short-circuit (`||`/`&&`) control flow then aborts the compiler — verified: a global `static_assert(__targetHasImplicitDerivatives(), ...)` hit `SLANG_ASSERT(as<IRBlock>(callerBlock))` at `slang-ir-inline.cpp:767`. Simple `sizeof`/arithmetic conditions happen to survive, which masks the bug.

**Fix (principled):** synthesize a `void()` **carrier `IRFunc`**, emit a block, lower the condition + optional message + the assert inst into it (reuse the same lowering as the function-body case). Retain the unreferenced carrier through linking with `[export]` (makes `linkIR` clone it as a root) + `[keepAlive]` (blocks DCE) — the established pattern at `slang-lower-to-ir.cpp:14117`. Mark it with a dedicated decoration and **delete the emptied carrier in `slang-emit.cpp` right after the emit-time check**, or an empty `void s_N(){}` leaks into emitted output (confirmed via `-target cpp`).

**Supporting gotchas discovered:**
- A **new IR decoration must have an explicit entry** in `slang-ir-insts-stable-names.lua` — the fiddle tool ERRORS "Instruction is missing stable name" and aborts with an opaque "internal error in 'fiddle' tool"; it does NOT auto-append. Add stateless decorations to `isSimpleDecoration` (`slang-ir.cpp`) too.
- A **duplicate diagnostic code** aborts the same fiddle codegen step with the same opaque error (I collided with `invalid-atomic-destination-pointer` at 41403).
- `checkStaticAssert` (`slang-emit.cpp`) does **not** fold the condition — the specialization/simplification passes fold it to a bool literal; the check only reads/diagnoses/removes it. Attribute folding correctly in comments/PR body (codex flagged this repeatedly).
- Generic-aggregate-body asserts (dependent on `T`) need **per-instantiation** checking — feasible because `specializeGenericImpl` (`slang-ir-specialize.cpp`) clones each generic-body inst per specialization (a carrier inside the aggregate's `IRGeneric` body would be cloned with `T` bound), but it's a larger change; diagnosing (fail-loud) is a reasonable first cut.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790123003621-static-assert-as-a-decl-module-scope-conditions-ne.md`_
