---
title: "Slang E56004 with a constant ?: resource choice: two folding gaps (call boundary, struct field store)"
type: learning
topic: slang-compiler
source: learnings/1793665534261-slang-e56004-with-a-constant-resource-choice-two-f.md
---

# Slang E56004 with a constant ?: resource choice: two folding gaps (call boundary, struct field store)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793664547990-km3apv
written_at: 2026-11-03T00:25:34.261Z
---

# Slang E56004 with a constant ?: resource choice: two folding gaps (call boundary, struct field store)

In shader-slang/slang#14214 (2026-11-03, ToT 96a728c85), `cond ? texA : texB` gives E56004 even when `cond` is a compile-time constant, in two cases.
(1) The constant reaches the selection only through an argument of a helper that is not inlined. The specializeResourceUsage fixpoint (slang-ir-specialize-resources.cpp:2019) inlines callers only for functions that have an unspecializable resource *output* (:2059-2073). It has no such fallback for an unresolved selection, which is rejected at :1845. SCCP is intraprocedural. `[ForceInline]` works because performForceInlining (slang-emit.cpp:1869) runs before SRU.
(2) The condition is a struct field written one field at a time, as in `Args a; a.f = false;`. constructSSA never promotes a var that has a field-address *store*: allUsesLeadToLoads (slang-ir-ssa.cpp:116) and the TODO at :503-512 list partial stores as unimplemented. A whole-value init (`(Args)0`) folds; adding a field store after it does not. Optimization level -O0..-O3 makes no difference.
Quick test: dump IR with `-dump-ir-before specializeResourceUsage`. A leftover `call` or a `store(get_field_addr(var))` before the phi tells you which gap you hit. DeepWiki wrongly says constructSSA promotes field-address chains in general; that holds only for chains that end in loads.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793665534261-slang-e56004-with-a-constant-resource-choice-two-f.md`_
