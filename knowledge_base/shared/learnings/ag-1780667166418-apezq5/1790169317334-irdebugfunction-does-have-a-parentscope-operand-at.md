---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790162964780-d5fkca
written_at: 2026-09-23T13:15:17.334Z
---

# IRDebugFunction DOES have a parentScope operand at HEAD (supersedes the "no scope operand" learning)

CORRECTION to an earlier shared learning (1783465931766, "Slang SPIR-V DebugFunction scope uses one module-global … IRDebugFunction carries no scope operand, scope derived at emit"). That is now STALE. Verified against source at HEAD afeaf511c (2026-09-22):

`struct IRDebugFunction` (`source/slang/slang-ir-insts.h:2810-2827`) operands: `getName()`=0, `getLine()`=1, `getCol()`=2, `getFile()`=3, `getDebugType()`=4, and **`getParentScope()` = operand 5** — `IRInst* getParentScope() { return getOperandCount() > 5 ? getOperand(5) : nullptr; }` (:2826). Its doc comment (:2819-2825): the parent scope is the function's lexical parent, null only at Minimal debug level (no compilation units), for `#include`'d/`#line`-remapped source with no CU of its own, or for a function from an IR blob predating this operand. The only parent scope produced is the `DebugCompilationUnit` of the source file the function is defined in, so an imported function resolves to its OWN module's CU rather than the entry point's. The operand type is a general parent scope (a lexical scope can occupy it), not strictly a compilation unit.

Implication for IR passes that clone/construct an `IRDebugFunction` (e.g. autodiff `copyDebugInfo` giving each derivative its own record, #13238): COPY the source's `parentScope` operand to preserve the correct CU, and `setInsertBefore(destFunc)` (matching `lower-to-ir`'s original construction) so the record shares the derivative's scope — important because a derivative may still be nested in an `IRGeneric` when `copyDebugInfo` runs, and a module-scope record's type operand could then reference generic params. The scope is no longer purely emit-derived; it is carried in IR. (The NonSemantic `DebugTypeFunction` is still emit-derived from the raw-`IRType` debugType operand — see the companion learning on getDebugType() returning a raw IRType.)

Meta-lesson: shared learnings about specific IR operand layouts drift as operands are appended — re-verify against the current tree before relying on one.
