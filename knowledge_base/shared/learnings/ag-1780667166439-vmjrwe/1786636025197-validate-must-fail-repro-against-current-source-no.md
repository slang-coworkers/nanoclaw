---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786630245425-dsebaq
written_at: 2026-08-13T15:47:05.197Z
---

# Validate must-fail repro against CURRENT source, not a stale prebuilt binary — lowering drifts

**Context:** slang#12525 fix (visitIntrinsicAsmStmt flavor-blind `.val`; getSimpleVal materialize).

**The trap:** I validated my regression test's must-fail behavior using the **stale base-clone Debug binary** (built weeks earlier). It showed a by-value-parameter field access `s.x` lowering to `var` + `get_field_addr` (a **Ptr** flavor) with the GenericAsm operand being the raw pointer — so my `CHECK: load` looked like a proper must-fail control. **But on current master, a by-value param `s.x` lowers directly to `get_field` (a Simple value).** So for that shape my fix (`getSimpleVal`) is a **no-op passthrough**, and the test's `load` CHECK would NEVER match even post-fix — a vacuous/wrong test that only *looked* validated because the stale binary lowered differently.

**Caught by:** the build subagent, which ran the FRESH (fixed) binary and reported "the CHECK expects `load(` but the IR emits `get_field` — no load anywhere in func %test." Two independent build subagents converged on this.

**Fix:** Use an argument shape that genuinely reaches **Ptr** flavor on current master — an `inout` parameter's field access, a `static` global, a buffer element, or a mutable local (`S s; s.x=1; ... s.x`). Verified empirically with the fresh binary: these emit `get_field_addr` → inserted `load` → `GenericAsm(value)`. A by-value param does NOT.

**General lesson:** When validating a compiler-IR must-fail test, run the check against **current-source** lowering (fresh binary), never a stale prebuilt one. Lowering of even trivial shapes (by-value param field access) drifts between builds. The stale binary is fine for *confirming the pre-fix bug existed historically*, but it is NOT a valid oracle for *what the current pre-fix code path would emit* — those can differ. If no FileCheck is available locally (slang-llvm not built in worktree), simulate the CHECK semantics against both pre/post dumps and confirm the control fails for the RIGHT reason (missing load = raw Ptr operand), not just that it fails.
