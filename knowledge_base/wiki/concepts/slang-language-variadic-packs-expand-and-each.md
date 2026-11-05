---
title: "Slang variadic packs: expand, each, pack queries and where they fold (AST vs IR)"
type: concept
group: slang-language-core
tags: [slang, variadic-generics, type-pack, value-pack, expand, each, countof, ExpandType, ExpandTypeOrVal, kIROp_Expand, lowerExpandType, maybeSpecializeCountOf, getPackBranchCardinality, maybeSpecializeExpand, visitEachExpr, tryConstantFoldExpr, EachIntVal, ExpandIntValPack, __trimFirst, __trimLast, __packBranch, getPackCardinalityFromStructure, E30105, E39999]
source_count: 5
---

# Slang variadic packs: expand, each, pack queries and where they fold (AST vs IR)

Slang's variadic generics have type packs (`each T`) and value packs (`let each S : int`), the
`expand <pattern>` form that maps a pattern over one or more captured packs, and pack queries such
as `countof`, `__packBranch`, `__trimFirst`/`__trimLast` and `__first`/`__last`. A pack query can be
answered in two places: in the front end (`ASTBuilder`, the Val layer, the checker's constant
folder), or in IR specialization (`slang-ir-specialize.cpp`). The pack bugs found in November 2026 (#14296,
#14297, and the reviews of #14313 and PR #14314) mostly came from one layer answering early with an incomplete
model of `expand`.
This page records where each decision is made, the bugs found at each layer, and the testing traps
that hid them. Printf/abort packs are on [[wiki/concepts/slang-compiler-printf-and-abort-variadic-arguments.md]];
empty-pack inference (#11210) is on [[wiki/concepts/slang-language-core-f0909b0-generics-overload-inference.md]].

## TL;DR

- **Find the layer first.** Dump `-dump-ir` and read the first `### LOWER-TO-IR` block. If the pack query is already a constant there (`specialize(%IntConst, 2)`, `countOf(tuple_type(Int))`), the front end decided it and no IR-list change can fix it.
- **Front-end folders:** `__packBranch`, `__trimFirst`/`__trimLast` and `__first`/`__last` fold in `ASTBuilder` and in `getPackCardinalityFromStructure` (`slang-syntax.h`).
- **Recurring AST root cause:** helpers count positional operands as pack elements. A `ConcreteTypePack` of `ExpandType`s counts as NonEmpty, `getTrimFirstPack`/`getTrimLastPack` drop a whole leading/trailing `expand`, and `getPackCardinalityFromStructure` ignores `ExpandType` elements.
- **IR rule:** `lowerExpandType` runs right after lowering and turns every `ExpandTypeOrVal` into `kIROp_Expand`. Any "still abstract, do not fold" op list that names `kIROp_ExpandTypeOrVal` but not `kIROp_Expand` is wrong (`maybeSpecializeCountOf` had this gap, #14297; `getPackBranchCardinality` has it too).
- **`expand each T` is not a real Expand.** `ASTBuilder::getExpandType` reduces it to bare `T`. Only `expand G<each T>` keeps an Expand, so test with a wrapped pattern.
- **`countof(Tuple<expand G<each T>>)` returned 1 for every pack size on master 3da6f63c0 (#14297).** Do not use it to check other pack fixes; use `countof(expand G<...>)` without `Tuple`, or a value-pack sum such as `sum<expand (each S) * 2>()`.
- **Value-pack `each` once worked only on a bare reference to the pack parameter.** `visitEachExpr` captured only a `DeclRefExpr`, and `tryConstantFoldExpr`'s `EachExpr` branch built `EachIntVal` only for a `GenericValuePackParamDecl`, so `each __trimLast(S)` gave E30105 / E39999. PR #14314 folds the operand.
- **When the capture comes from folding the operand, keep the declref capture as a fallback.** `let p = S; expand add(s, each p);` does not fold (a non-const `LetDecl`), and "capture = fold(operand)" turns a working program into E30105.
- **`expand` takes its length from capture 0 only.** No code compares the lengths of the other captured packs: a mismatch gives a silent wrong count, dropped elements, or a slangi segfault. `S` together with `__trimFirst(S)` is always off by one.
- **Pack tests need order-sensitive folds.** `sum`/`countof` give the same answer for any element order, so swapped `__trimFirst`/`__trimLast` still pass. Fold with `a = a*100 + b` over pairs.
- **`-output-using-type` CHECK trap:** the first output line is `type: int32_t`, so `CHECK: 3` matches inside it. Start with `CHECK: type: int32_t`, then `CHECK-NEXT`.
- **`-dump-ir` does not print an `Expand`'s capture operands.** Compare the dump before and after `specializeModule` to see where a fold happened.

## Where a pack query is decided: check LOWER-TO-IR before blaming an IR list

The front end often settles a pack query before any IR exists. `__packBranch`, `__trimFirst`/`__trimLast`
and `__first`/`__last` fold in `ASTBuilder` and in `getPackCardinalityFromStructure` (`slang-syntax.h`),
so a wrong answer need not come from the IR cardinality lists in `slang-ir-specialize.cpp`
(`getPackBranchCardinality`, `maybeSpecializeCountOf`). Before proposing to add an op to one of those
lists, look at the first `### LOWER-TO-IR` block of `-dump-ir`. If it already holds the folded value,
the bug is in the AST. On #14313 (2026-11-04) all three reviewers asked for `kIROp_Expand` in
`getPackBranchCardinality`; a rebuild with that change still printed the wrong `2 2`, because the AST
counts a `ConcreteTypePack` of `ExpandType`s as NonEmpty. The same root cause recurs across the AST
helpers, which count positional operands as elements: `getTrimFirstPack`/`getTrimLastPack` drop a
whole leading or trailing `expand`, and `getPackCardinalityFromStructure` ignores `ExpandType`
elements. Side tip: `slangi` has no `-I` flag and loads `import foo;` from `foo.slang-module` in the
cwd, so to test the precompiled path compile `slangc foo.slang -o foo.slang-module` and move
`foo.slang` aside [check LOWER-TO-IR before blaming an IR pack-cardinality list](../learnings/1793819033261-slang-variadic-packs-check-lower-to-ir-before-blam.md).

## The IR side: `kIROp_Expand` must be in every bail-out list (#14297)

When the query does survive into IR, the IR lists are the next suspect. `lowerExpandType` runs right
after IR lowering and turns every `ExpandTypeOrVal` into `kIROp_Expand`, with the captures as operands
and the pattern in a child block. From then on, a list of "still abstract, do not fold yet" ops that
names `kIROp_ExpandTypeOrVal` but not `kIROp_Expand` folds too early. `maybeSpecializeCountOf`
(slang-ir-specialize.cpp:1162) had exactly that gap, so `countof(Tuple<expand Wrap<each T>>)` returned
1 for every pack size (#14297); `getPackBranchCardinality` (:1042) has the same gap, although on #14313
the AST fold above made it unreachable. `Tuple<expand each T>` hides the bug, because
`ASTBuilder::getExpandType` reduces `expand each T` to a bare `T` (a `Param`); only `expand G<each T>`
keeps a real Expand. A mixed tuple such as `Tuple<expand Wrap<each T>, expand each T>` also counts
correctly, because its `Param` operand stops the early fold. In `-dump-ir` an `Expand` does not print its
capture operands, so compare the dump before and after `specializeModule` to find the fold
[IR countOf folds TupleType(Expand) early](../learnings/1793810978051-ir-countof-folds-tupletype-expand-early-bail-out-l.md).

## Value-pack `each`: the operand shape and the capture (#14296, PR #14314)

On master 3da6f63c0, `each <expr>` over a value pack (`let each S : int`) worked only when `<expr>` was
a plain reference to the pack parameter. Two checker branches in slang-check-expr.cpp enforced that:
`visitEachExpr` (~:8216) recorded the expand capture only for a `DeclRefExpr`, and the `EachExpr`
branch of `tryConstantFoldExpr` (~:3136) built an `EachIntVal` only for a `GenericValuePackParamDecl`.
So `each __trimLast(S)` gave E30105 ("expand captures no type packs") in an expression, and E39999
("not a compile-time constant") as a generic value argument. The type-pack branch of `visitEachExpr`
has no such limit, and the Val layer (`EachIntVal(TrimLastIntValPack)`, `ExpandIntValPack`) already
substitutes correctly, so the fix belongs in those two checker branches: fold the operand once with a
shared helper. In a `git worktree` of the slang clone, `git submodule update` fails with "transport
'file' not allowed"; use `git -c protocol.file.allow=always submodule update --init --recursive`
[value-pack each only handles a bare DeclRefExpr](../learnings/1793811048051-value-pack-each-only-handles-a-bare-declrefexpr-op.md).

Folding the operand is not enough on its own. Consider `let p = S; expand add(s, each p);`. Here `p` is
a runtime local of `ValuePackType`, and `tryConstantFoldExpr` returns null for it (a `LetDecl` without
`const` does not fold), so a "capture = fold(operand)" rule drops the capture and the program fails with
E30105, although master compiles it and prints 6. PR #14314 therefore folds the operand, so that
`each __trimFirst(S)` works, and keeps the old `DeclRefIntVal(valPackType, declRef)` capture as the
fallback for a `DeclRefExpr` that does not fold. No existing test covered the local-pack form;
`/code-review medium` found it [each capture: a local that holds a pack does not constant-fold](../learnings/1793815993642-value-pack-each-capture-a-local-that-holds-a-pack-.md).

## `expand` over packs of different lengths is never checked

`expand` takes its length from capture 0 only (`ExpandIntValPack::_substituteImplOverride`,
slang-ast-val.cpp:3108, and `maybeSpecializeExpand` in slang-ir-specialize.cpp), and no code compares
the other captured packs. In Release on master 3da6f63c0: `countof(expand Layer<each A, each B>)` with
|A| = 3 and |B| = 2 returns 3 with no diagnostic; using the elements (`Layer<each A, each B>().get()`)
segfaults slangi (exit 139); and a run-time `(each Short) * (each Long)` silently drops elements, while
the reverse order segfaults. Once #14314 lets `each __trimFirst(S)` be captured, pairing `S` with
`__trimFirst(S)` (always off by one) reaches this through a one-token slip in the common layer-pair
pattern. #12796 is a related open segfault from captures of different arity with a different trigger.

Two testing lessons came from the same review. A test that folds a pack through `sum` or `countof`
gives the same result for any element order: with `__trimFirst`/`__trimLast` swapped, all 10 lines of
the PR test still passed. Use an order-sensitive fold (`a = a*100 + b`) on pairs such as
`(each __trimLast(S))*10 + (each __trimFirst(S))`. And in COMPARE_COMPUTE with `-output-using-type` the
first output line is `type: int32_t`, so a first `CHECK: 3` matches the "3" in `int32_t`; start with
`CHECK: type: int32_t`, then use `CHECK-NEXT` [captured packs of different lengths are never compared](../learnings/1793820351955-slang-expand-captured-packs-of-different-lengths-a.md).

**Source learnings (5):**
- [Slang variadic packs: check LOWER-TO-IR before blaming an IR pack-cardinality list](../learnings/1793819033261-slang-variadic-packs-check-lower-to-ir-before-blam.md) — #14313: AST folds `__packBranch`/trims first; positional-operand counting in AST helpers; slangi `.slang-module` tip
- [IR countOf folds TupleType(Expand) early — bail-out lists must include kIROp_Expand](../learnings/1793810978051-ir-countof-folds-tupletype-expand-early-bail-out-l.md) — #14297: `lowerExpandType` → `kIROp_Expand`; `expand each T` reduces to `T`; compare around `specializeModule`
- [Value-pack `each` only handles a bare DeclRefExpr operand (#14296)](../learnings/1793811048051-value-pack-each-only-handles-a-bare-declrefexpr-op.md) — `visitEachExpr` + `tryConstantFoldExpr` limits; E30105/E39999; worktree submodule tip
- [Value-pack `each` capture: a local that holds a pack does not constant-fold](../learnings/1793815993642-value-pack-each-capture-a-local-that-holds-a-pack-.md) — PR #14314 keeps the declref capture fallback for `let p = S`
- [Slang expand: captured packs of different lengths are never compared](../learnings/1793820351955-slang-expand-captured-packs-of-different-lengths-a.md) — length from capture 0; silent count or segfault; order-sensitive folds; `type: int32_t` CHECK trap
