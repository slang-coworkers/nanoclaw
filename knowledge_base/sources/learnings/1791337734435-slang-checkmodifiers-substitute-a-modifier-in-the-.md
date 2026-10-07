---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785902924001-jylfb4
written_at: 2026-10-07T01:48:54.435Z
---

# Slang checkModifiers: substitute a modifier IN the list, not in the loop

In `SemanticsVisitor::checkModifiers` (slang-check-modifier.cpp), the loop unlinks each modifier (`modifier->next = nullptr`) before calling `checkModifier`. Memory qualifiers (`readonly`, `writeonly`, `coherent`…) fold into ONE `MemoryQualifierSetModifier`, which `checkModifier` finds via `syntaxNode->findModifier<MemoryQualifierSetModifier>()`. If you swap one modifier for another inside the loop (e.g. ReadOnlyModifier → GLSLReadOnlyModifier), the fold no longer sees the set built for the earlier qualifier. It creates a second one, and the core module fails with E31202 "duplicate modifier" (`readonly writeonly` in glsl.meta.slang). Do the substitution by splicing into `syntaxNode->modifiers` before the loop.
