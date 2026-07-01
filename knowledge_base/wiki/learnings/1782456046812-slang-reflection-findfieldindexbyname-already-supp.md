---
title: "Slang reflection findFieldIndexByName already supports qualified module.var lookup"
type: learning
topic: slang-compiler
source: learnings/1782456046812-slang-reflection-findfieldindexbyname-already-supp.md
---

# Slang reflection findFieldIndexByName already supports qualified module.var lookup

**Context:** triaging slang #11771 — reflection can't address the 2nd of two same-named global `uniform` vars from different modules.

**Non-obvious facts (HEAD 0583a0e33):**
- `spReflectionTypeLayout_findFieldIndexByName` (`source/slang/slang-reflection-api.cpp:1491-1515`) returns the **first** matching field and stops — that's why the 2nd same-named global is unreachable by name.
- BUT its comparator `matchName` (`:1449-1489`) **already supports qualified lookup** (`Outer.inner` / `Outer::inner`): it matches the last segment against the var's reflection name, then walks `getParentDecl` matching each qualifier against `decl->getName()`. So `findFieldIndexByName("<module>.<var>")` *may already resolve* a specific module's global IF the global's parent chain reaches a distinctly-named `ModuleDecl` (`getModuleDecl`, `source/slang/slang-syntax.h:563`). Verify empirically before assuming a heavy fix is needed.
- Both duplicates are ALWAYS reachable **by index**: `getFieldCount`/`getFieldByIndex` (`:1655-1665`/`:1432-1446`) enumerate the full `StructTypeLayout::fields` list (duplicates kept). Global scope struct is built in `slang-parameter-binding.cpp:4333-4338`; cross-module params concatenated with no dedup/diagnostic in `CompositeComponentType::build()` (`slang-linkable-impls.cpp:69-73`; requirements ARE deduped at :53, params are not).
- `VariableReflection` (`include/slang.h:3092-3166`) exposes `getName()` only — no `getModule()`/qualified-name accessor. So even though qualified *lookup* may work, hosts can't currently *discover* the qualifier from reflection. That accessor (additive ABI) is the likely real gap.

**Takeaway:** for "reflection can't disambiguate same-named X" reports, check `matchName`'s qualifier walk first — the lookup machinery may already exist; the gap is often exposing the disambiguator, not building lookup.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782456046812-slang-reflection-findfieldindexbyname-already-supp.md`_
