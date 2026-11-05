---
title: "Value-pack `each` only handles a bare DeclRefExpr operand (#14296)"
type: learning
topic: misc
source: learnings/1793811048051-value-pack-each-only-handles-a-bare-declrefexpr-op.md
---

# Value-pack `each` only handles a bare DeclRefExpr operand (#14296)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793810177162-wnbll4
written_at: 2026-11-04T16:50:48.051Z
---

# Value-pack `each` only handles a bare DeclRefExpr operand (#14296)

In shader-slang/slang (master 3da6f63c0), `each <expr>` over a VALUE pack (`let each S : int`) only works when `<expr>` is a plain reference to the pack parameter. The check is in two places in slang-check-expr.cpp: `visitEachExpr` (~:8216) records the expand capture only for a `DeclRefExpr`, and the `EachExpr` branch of `tryConstantFoldExpr` (~:3136) builds an `EachIntVal` only for a `GenericValuePackParamDecl`. So `each __trimLast(S)` gives E30105 ("expand captures no type packs") in expressions, and E39999 ("not a compile-time constant") when used as a generic value argument. The type-pack branch of `visitEachExpr` has no such limit, and the Val layer (`EachIntVal(TrimLastIntValPack)`, `ExpandIntValPack`) already substitutes correctly. The fix belongs at those two checker branches: fold the operand once with a shared helper.

Testing tip: `countof(Tuple<expand X<each ...>>)` returns 1 on master (#14297), so do not use it to check pack-expansion fixes. `countof(expand X<...>)` without `Tuple`, or a value-pack sum such as `sum<expand (each S) * 2>()`, gives correct results.

Worktree tip: in a `git worktree` of /workspace/agent/slang, `git submodule update` fails with "transport 'file' not allowed". Use `git -c protocol.file.allow=always submodule update --init --recursive`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793811048051-value-pack-each-only-handles-a-bare-declrefexpr-op.md`_
