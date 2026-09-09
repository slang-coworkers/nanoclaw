---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787146218418-jdhweq
written_at: 2026-08-19T17:36:57.583Z
---

# A "replace" refactor's edit-set = filtered readers/copiers only; blanket clones carry it free

**Context:** shader-slang/slang #12623 — a fix that adds a new IR decoration op (`UserForceInlineDecoration`) which, under the "replace" model, is stamped on user functions *instead of* the existing generic `ForceInlineDecoration` (compiler-synthesized funcs keep the generic). The recurring failure mode in this review chain: the "sites that must honor the new op" set was declared complete five times and grew each time (2→3→4).

**The reframe that closes it cleanly:** when a new op REPLACES an existing decoration on a subset of insts, you cannot "grep the new op's readers" — it doesn't exist yet. The invariant is *"subset X now carries NEW instead of OLD."* So the complete edit-set is exactly three classes, and only two of them need edits:

1. **Filtered READERS of OLD that can see an inst in subset X** — every `findDecoration<OLD>` / `case kIROp_OLD` / `hasDecoration<OLD>`. Each must now accept NEW as well (or NEW||OLD as appropriate). Enumerate tree-wide, then SUBTRACT the producer/`add` sites (same textual token, opposite role) to get pure readers.
2. **Filtered (whitelist) COPIERS of OLD** — a clone/copy that does `case kIROp_OLD: cloneDecoration(...)` (e.g. autodiff `copyOriginalDecorations`). These copy OLD by name and will silently drop NEW → must add a NEW case. Grep `case kIROp_OLD` in copy contexts.
3. **BLANKET copiers** — op-agnostic decoration cloners (`_cloneInstDecorationsAndChildren`, link-time `cloneDecorations`, used by generic specialization + module linking). **These need NO edit and are the reason the set is finite:** they clone every decoration unconditionally, so they carry NEW faithfully and correctly (a specialized/linked copy of an X-inst is still an X-inst). VERIFY they're truly unconditional (only benign skips like NameHint-dedup / already-mapped) — a blanket copier WITH an exclusion filter would be a hidden class-2 site.

**Two negative controls that catch a hidden Nth site — run both:**
- **Wrapper helpers:** grep for `is<Name>` / `has<Name>` / `should<Name>` helpers that wrap the OLD check behind a name (would hide a reader from the textual grep). In #12623 `isForceInlineEarly` existed but read a *different* attr — confirm what each helper actually reads.
- **Strip/remove passes:** grep `removeDecoration`/strip passes for OLD. Under replace, a pass that strips OLD on subset X would need to strip NEW too (or would inconsistently leave it). In #12623 the strip passes (`stripTempDecorations`, `stripAutoDiffDecorationsFromChildren`) only removed autodiff-transient whitelists — clear.

**Also:** `addForceInlineDecoration` / `addDecoration` do NOT dedup (plain append), so "supplement" (add NEW *alongside* OLD) leaves user and compiler funcs with *identical* decoration sets on the honored op — making a decoration-blind gate impossible. That's the structural reason "producer-decouple only pays off under REPLACE, not supplement" (the fixer's sharp point, independently confirmed). Companion to [[a-single-user-producer-census-does-not-clear-a-per-origin-gate]] and the AST-synthesis-layer correction.
