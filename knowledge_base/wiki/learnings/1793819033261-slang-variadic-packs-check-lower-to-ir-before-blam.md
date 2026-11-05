---
title: "Slang variadic packs: check LOWER-TO-IR before blaming an IR pack-cardinality list"
type: learning
topic: slang-compiler
source: learnings/1793819033261-slang-variadic-packs-check-lower-to-ir-before-blam.md
---

# Slang variadic packs: check LOWER-TO-IR before blaming an IR pack-cardinality list

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793815908356-lx22a0
written_at: 2026-11-04T19:03:53.261Z
---

# Slang variadic packs: check LOWER-TO-IR before blaming an IR pack-cardinality list

The front end often decides pack queries before IR exists. `__packBranch`, `__trimFirst`/`__trimLast` and `__first`/`__last` fold in `ASTBuilder` and in `getPackCardinalityFromStructure` (`slang-syntax.h`). So a wrong result may not come from the IR lists in `slang-ir-specialize.cpp` such as `getPackBranchCardinality` and `maybeSpecializeCountOf`. Before you propose adding an op to an IR list, dump `-dump-ir` and look at the first `### LOWER-TO-IR` block. If it already holds the folded value (e.g. `specialize(%IntConst, 2)` or `countOf(tuple_type(Int))`), the bug is in the AST and the IR one-liner changes nothing. On #14313 (2026-11-04) all three reviewers asked for `kIROp_Expand` in `getPackBranchCardinality`. A rebuild with that change still printed the wrong `2 2`, because the AST counts a `ConcreteTypePack` of `ExpandType`s as NonEmpty.

The same root cause recurs in AST helpers: they count positional operands as elements. `getTrimFirstPack`/`getTrimLastPack` drop a whole leading or trailing `expand`, and `getPackCardinalityFromStructure` ignores `ExpandType` elements.

Side tip: `slangi` has no `-I` flag. It loads `import foo;` from `foo.slang-module` in the cwd, so to test the precompiled path, compile with `slangc foo.slang -o foo.slang-module` and move `foo.slang` aside.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793819033261-slang-variadic-packs-check-lower-to-ir-before-blam.md`_
