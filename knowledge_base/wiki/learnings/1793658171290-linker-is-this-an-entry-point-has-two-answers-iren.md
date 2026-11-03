---
title: "Linker 'is this an entry point?' has two answers — IREntryPointDecoration on the source func is NOT reliable"
type: learning
topic: misc
source: learnings/1793658171290-linker-is-this-an-entry-point-has-two-answers-iren.md
---

# Linker "is this an entry point?" has two answers — IREntryPointDecoration on the source func is NOT reliable

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793652245896-1j98hs
written_at: 2026-11-02T22:22:51.290Z
---

# Linker "is this an entry point?" has two answers — IREntryPointDecoration on the source func is NOT reliable

Found on shader-slang/slang#14200 / PR #14202 (body-less `__extern_cpp` / `[DllImport]` entry point crashed or was dropped instead of E45001).

- `IREntryPointDecoration` sits on the SOURCE IR func only when the front end knew at lowering time (a `[shader]` attribute, or `slangc -entry X`, which decorates listed entry points). With the API `loadModuleFromSourceString` + `IModule::findAndCheckEntryPoint("X")` on a func WITHOUT `[shader]`, no link candidate carries it. `specializeIRForEntryPoint` (slang-ir-link.cpp) adds it to the CLONE only, after cloning. A gate keyed on the decoration in `cloneGlobalValueWithLinkage` / `isFunctionDefinedOrImported` therefore misses the API path.
- Conversely, a callee clone keeps the source decoration. `slangc -target cpp` WITHOUT `-o` links each entry point separately, so in `Caller`'s link a `[shader]` callee `NoBody` is "just a callee" yet later passes legalize it as an entry point. A check that lives only in `specializeIRForEntryPoint` segfaults there.
- What worked: both checks, with ONE shared predicate on the same bestVal (an extracted `findBestValueForTarget`). Cloning reports when `isFunctionDefinedOrImported(bestVal)` is false; `specializeIRForEntryPoint` reports a body-less clone only when it is true. The cases are disjoint, so each body-less entry point gets one E45001 per link in any clone order, without dedup state.
- Gotchas: in `addLinkageDecoration` (lower-to-ir) `UserExternDecoration` is ALWAYS paired with `IRImportDecoration`, so excluding only `UserExtern` does nothing. `extern "C"` is not Slang syntax; `ExternCDecoration` comes only from the PyTorch binding pass. A plain `extern` body-less entry point crashes earlier, at the #12728 `IRPtrLit` assert in cloneDecorations.
- Diagnostic tests (`diag=`): for a given prefix, caret annotations resolve against the previous line that is not an annotation OF THAT PREFIX. Another prefix's annotation lines count as code, so use position-free substring annotations for a second prefix. One E45001 produces two matchable items (the code/title and the span message `unresolved external symbol 'X'.`), and each note is another item.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793658171290-linker-is-this-an-entry-point-has-two-answers-iren.md`_
