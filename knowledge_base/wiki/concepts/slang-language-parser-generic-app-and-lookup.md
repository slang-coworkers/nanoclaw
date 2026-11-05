---
title: "Slang Parser: tryParseGenericApp Classification, Parser-Time Lookup, and ?: Precedence"
type: concept
group: slang-language-core
tags: [parser, tryParseGenericApp, generic-app, CheckTerm, swizzle, DeclRefType, parser-lookup, CompleteDecl, AddMember, local-decl, enum, parseDeclBody, e39999, e30015, test-masking, namespace, parseNamespaceDecl, PushScope, ownedScope, pushLookupScope, ternary, precedence, compound-assignment, e30047, parsePostfixExpr, pointer-type, follow-set, EndOfFile, parseTermString, findTypeByName, release-tarball-bisect]
source_count: 17
---

# Slang Parser: tryParseGenericApp Classification and Parser-Time Lookup

How the Slang parser decides whether `name <` opens a generic application or is a less-than comparison, and the parser-time scope lookup that decision depends on: #13426 (swizzle bases, PR #13429), #13428 (local declarator groups, PR #13432), the #13434 review of suspending `parser->semanticsVisitor` in `parseDeclBody`, and the #13701 `namespace A::B` reopen fix (PR #13711). It also records how `?:` operands are parsed and why changing that is breaking (#13870, PR #13874), and the postfix `*` follow set (#14055, PR #14203). Related: the decl-vs-statement and language-server-suite rules on [[wiki/concepts/slang-compiler-frontend-and-checking.md]], the #12892 `tryParseGenericApp` merge calibration on [[wiki/concepts/review-approver-merge-join-calibration.md]], and checker-side lookup (`_lookUpInScopes`, function-local types, extension bodies) on [Slang Scope Lookup, Function-Local Types, and Declaration Checking](../concepts/slang-language-scope-lookup-and-declaration-checking.md).

## TL;DR

- In body-stage parsing, `tryParseGenericApp` runs `CheckTerm` on the expression before `<` and classifies the checked base. A base left `Unknown` falls back to the FOLLOW-set heuristic, which misparses `uv.y < a || uv.y > (a)` as a generic app (E39999).
- Classify a checked base as NonGeneric with the positive test `as<DeclRefType>(checkedBase->type.type)`: every run-time value type derives from `DeclRefType`, kind-like types, ErrorType and a null type do not, so a new Type kind stays Unknown by default.
- Reuse the checked base only when its kind is not Unknown: `visitMemberExpr` rewrites `baseExpression` in place (re-checking gives E30101 on `p->y`), and `h.o.get<3>()` checks to a `LetExpr` that generic-overload collection rejects.
- Decl-stage expressions (global initializers) have no semantics visitor and still use the heuristic for every shape, so a body-stage classification fix does not reach them. Ask which a report is before replying.
- The declarators of one local statement (`int a = …, b = …;`) enter the scope only in `CompleteDecl`, so a later declarator's initializer cannot see earlier ones through parser-time lookup (E30015, or a shadowed global wins).
- An early-registration fix must be Body-stage only (every stage breaks the core-module bootstrap), and the later `AddMember` skip must be keyed on the early-add path: keying on `checkState` double-adds (infinite lookup); keying on `parentDecl == containerDecl` drops every enum.
- A slang-bootstrap InternalError in `getSpecializedBuiltinType` after a parser change can be lost core-module `__magic_enum` types; rebuild each variant separately to isolate it.
- A local `enum` written directly in a function body is rejected at parse (E30102 + E20001 + E30015); one nested in a local struct goes through `parseDeclBody`. Probe source-only reviewer claims before relaying them.
- `Parser::PushScope(ContainerDecl*)` pushes a scope AND sets `ownedScope`, onto which the checker wires imported same-name namespaces; an owning push on an existing namespace detaches imported names (E30015). For lookup only, use `Parser::pushLookupScope`.
- For `namespace A::B {}` with both declared, the lookup-only push is the merged fix (#13711). Owning breaks earlier `A` bodies; borrowing `A->ownedScope` leaks `using namespace`. Imported members of `A` stay invisible inside `A::B` (#13714).
- The `A::B` fix makes `A`'s members hide a same-named global; the maintainer accepted it as a non-breaking bug fix toward the nested spelling.
- A regression row for a parser-lookup bug must use names no global in the file declares, or lookup falls back and the row passes on master. Verify each headline row with a master binary, with and without the global.
- Before attributing full-suite failures to a parser change, rerun exactly the failing set with the change reverted (~30 pre-existing local failures).
- Label a change that alters which programs are accepted `pr: breaking change` by default, or call the label a judgement call; if relabelled, reply with a measured master-vs-branch exposure table.
- `?:` parses both operands at `Precedence::TernaryConditional`, so `c ? x : y op= z` is `(c ? x : y) op= z` (E30047), unlike C++/HLSL. Widening the middle operand is additive (mind the Slang 2026 comma rule); widening the last is breaking, because a user by-value `operator/=` makes today's parse compile with another meaning.
- `parsePostfixExpr` decides pointer type vs multiply for `*` with a follow set; generic args and `Linkage::parseTermString` (reflection `findTypeByName`) use the same grammar. The `a * *p` fix (#14055) skips the `*` run; its follow set must include `EndOfFile`, and `int**(x)` must stay a cast.
- Before calling a parser change non-breaking, run every token class it reroutes through master, plus the API string path in a reflection unit test. Two adjacent release tarballs and `git log vA..vB -- <file>` name a regression's culprit in a minute.
- Function bodies are `UnparsedStmt` and parse after module-scope declarations, so body lookups see later declarations. `_tryResolveDecl` handles only `VarExpr`/`StaticMemberExpr`.
- To prove a parser change keeps meanings, diff a revert-only base build over all tests and compare `riff` core-module archives, ignoring known nondeterministic bytes. Give probes a real `-o` file (`-o /dev/null` gives E00004, #13294).

## How tryParseGenericApp classifies the base of `name <` (#13426, PR #13429)

Consider this example:

```slang
float f(float2 uv, float a)
{
    return (uv.y < a || uv.y > (a)) ? 1.0 : 0.0;
}
```

In a function body, `tryParseGenericApp` (`slang-parser.cpp` ~:2985) calls `CheckTerm` on `uv.y` before deciding what `<` means. Before the fix it classified only a `DeclRefExpr` (a `MemberExpr` is one) and an `OverloadedExpr`. A `SwizzleExpr` (vector `uv.y`, scalar `a.x`, tuple `t._0`) or `MatrixSwizzleExpr` (`m._m00`) stayed `Unknown` and fell to the FOLLOW-set heuristic, which sees `< a || uv.y >` followed by `(` and builds a generic app, ending in E39999. A struct field (`s.y`) worked, and plain names had been fixed by #6281. Decl-stage parsing (global initializers) has no semantics visitor, so it still uses the heuristic for every shape [tryParseGenericApp: swizzle bases bypass the body-stage classification](../learnings/1791128536486-slang-tryparsegenericapp-swizzle-bases-swizzleexpr.md).

The fix classifies the checked base by its type, not its expression node: one positive branch, `else if (as<DeclRefType>(checkedBase->type.type)) baseKind = NonGeneric;`, which also covers tuple elements and existential members. An exclusion list (anything not TypeType/FuncType/GenericDeclRefType/OverloadGroupType/ErrorType/NamespaceType) gives the same result today, but the positive test makes a later Type kind default to `Unknown` rather than be silently treated as a value (kind-like types, `ErrorType` and the null type of a `PartiallyAppliedGenericExpr` are not `DeclRefType`s). A 12-line prototype fixed every body shape with no new full-suite failures [as<DeclRefType> classification and the checkedBase reuse pitfalls](../learnings/1791149609749-slang-tryparsegenericapp-classify-by-as-declreftyp.md).

Reusing the already-checked base (introduced by #12892) has two pitfalls, both found within a minute of an A/B against a master `slangc`. `visitMemberExpr` rewrites `expr->baseExpression` in place, so returning the raw `MemberExpr` after `CheckTerm` checks it twice and `p->y` with `float2* p` reports a false E30101; the reuse must widen to every `baseKind != Unknown`. But it must not be unconditional: `h.o.get<3>()`, with `o` an interface-typed field, checks to a `LetExpr`, which `AddGenericOverloadCandidates` rejects with E39999 [same](../learnings/1791149609749-slang-tryparsegenericapp-classify-by-as-declreftyp.md).

A local full `slang-test` run can show about 30 pre-existing failing files (a stale `slang.numerics` standard-module build, gfx-smoke without a GPU); rerun exactly that set with the change reverted before attributing any to the parser change [same testing note](../learnings/1791128536486-slang-tryparsegenericapp-swizzle-bases-swizzleexpr.md).

## Labelling parser disambiguation changes `pr: breaking change`

PR #13429 was opened as `pr: non-breaking` because probes found no program that compiled before and changed meaning; code that used to error now compiles (`uv.y<2>(3)` parses as `(uv.y<2)>(3)`) and some diagnostics differ. The shepherd (skiminki-nv) relabelled it `pr: breaking change` for "at least a theoretical chance that this fix breaks existing code". For a parser or disambiguation change that alters which programs are accepted, default to `pr: breaking change` or say the label is a judgement call; when a maintainer flags it, accept and reply with a measured exposure table (master vs branch, per spelling) rather than arguing. Editing the PR body or labels does not re-trigger `ci.yml` (`pull_request` types opened/synchronize/reopened/ready_for_review), so status text can be fixed while CI runs on a held head ([maintainers flag parser disambiguation changes as `pr: breaking change` even when they only accept previously-rejected code](../learnings/1791192194734-slang-maintainers-flag-parser-disambiguation-chang.md)).

## Conditional `?:` operand precedence (#13870, PR #13874)

`parseInfixExprWithPrecedence` (`slang-parser.cpp` ~8293-8306) parses both `?:` operands with `ParseExpression(Precedence::TernaryConditional)`, whereas C++, HLSL and GLSL take a full expression in the middle and an assignment-expression last. So `c ? b /= 2 : 0` does not parse (#13870), and `c ? 0.0 : b /= 2.0` is `(c ? 0.0 : b) /= 2.0`, failing with E30047 (l-value). DeepWiki inverts this (it claims assignment already nests inside ternary operands), so answer precedence questions from the code and a probe. DXC and g++ accept both forms; gcc in C mode rejects the last-operand form ([middle-operand widening is additive, third-operand widening is not](../learnings/1792684737065-slang-operand-precedence-middle-operand-widening-i.md)).

Widening the **middle** operand to `ParseExpression()` (Comma level) is additive in parse terms: only Comma and Assignment sit below TernaryConditional, and `:` returns `Precedence::Invalid`, so every middle operand that parses today parses the same way. It still meets a language-version rule: Slang 2026 (SP#027) removes the comma operator inside parentheses, so letting a comma operator nest there needs the 2026 docs narrowed or a gate (the E41024 comma warning is already off in Slang 2026, `isSlang2026OrLater`). Widening the **last** operand to Assignment is breaking. A bot review on #13874 called it backward compatible "because ?: is never an l-value", which holds only for plain `=`. Compound assignment operators are overloadable, overload resolution ignores l-value-ness, and a non-generic user overload beats the generic core `inout` one: with a by-value `S operator/=(S a, float b)`, `S z = c ? x : y /= 2.0;` compiles today as `operator/=(c ? x : y, 2.0)` (HLSL `_x3D_0(_S1, 2.0f)`) and would silently become `c ? x : (y /= 2.0)` (verified on Release, 2026-10-22) ([last-operand change is breaking for compound ops](../learnings/1792694250367-slang-last-operand-precedence-change-is-breaking-f.md)).

A middle-only fix such as PR #13874 therefore does not make `flags = c ? flags |= m : flags &= ~m` compile, because the second compound assignment is in the last operand; check the last operand of every acceptance example before promising it. An exhaustive `DIAGNOSTIC_TEST` for the remaining error must annotate both E30047 lines, "argument must be l-value" and "argument passed to parameter '0' must be l-value." ([the last operand is parsed at the ?: level](../learnings/1792691643285-slang-the-last-operand-is-parsed-at-the-level-so-c.md)).

## Postfix `*`: pointer type vs multiply (#14055)

`parsePostfixExpr` (case `OpMul`, ~:9622) decides between pointer type and multiply with one token of lookahead: a `*` followed by one of `, ) > >> : ; [ * .` is a pointer type. Generic arguments go through the EXPRESSION grammar (`_parseGenericArg` → `ParseArgExpr`), so `RWStructuredBuffer<int**>` and `bit_cast<int**>(x)` depend on the `*`-after-`*` entry, which also breaks `a * *p` (#14055, a regression from #6627). Deleting the token, as #6686 did for `::`, is not the fix; skip the run of `*` tokens and test the follow set on the token after it. To find such a regression without a local bisect build, download two adjacent releases (`https://github.com/shader-slang/slang/releases/download/v<X>/slang-<X>-linux-x86_64.tar.gz`), run each as `LD_LIBRARY_PATH=r<X>/lib r<X>/bin/slangc`, and `git log vA..vB -- <file>` names the culprit in about a minute [Slang parser: postfix `*` lookahead is load-bearing for `T**` in generic args; bisect regressions with release tarballs](../learnings/1793311726672-slang-parser-postfix-lookahead-is-load-bearing-for.md).

The fix's brief claimed "a `*` run followed by the follow set can never be a multiply, so only rejected programs change". It was wrong twice [Slang parser lookahead changes: A/B every token class you reroute, including EOF and `(`](../learnings/1793320104546-slang-parser-lookahead-changes-a-b-every-token-cla.md) [Slang parser follow-set changes: include EndOfFile (reflection findTypeByName reaches the expression parser)](../learnings/1793320137908-slang-parser-follow-set-changes-include-endoffile-.md):

1. **EndOfFile.** `Linkage::parseTermString` parses type strings through the expression grammar: reflection `findTypeByName`, entry-point generic-argument strings, render-test `TEST_INPUT:type`. Those end at EOF. `"int**"` only worked because the second `*` matched the old `OpMul` entry, so skipping the run made `findTypeByName("int**")` silently return NULL. The fix adds `EndOfFile` to the follow set, as `maybeParseGenericApp` already does, which also fixes `findTypeByName("int*")` (NULL on master). slang-test `.slang` files do not cover this path; a small reflection unit test (`findPointerTypeByName`) does.
2. **`(`.** `int**(x)` (a pointer-type function-style cast) compiles on master while `int*(x)` does not, so two or more `*` before `(` must keep the type reading; rerouting `(` silently breaks code that compiles today.

So before claiming a parser change is non-breaking, run every token class it reroutes through the master binary, not only the tokens in the brief, and cover the API string path with a reflection unit test [Slang parser lookahead changes: A/B every token class you reroute, including EOF and `(`](../learnings/1793320104546-slang-parser-lookahead-changes-a-b-every-token-cla.md).

**Parse-time lookup facts behind the follow-up fix (PR #14203).** PR #14203 separates `a * *p` from `int**` by asking whether the expression before `*` can name a type; two peer-review rounds settled the facts it relies on [Slang parser: parse-time lookup facts for disambiguation fixes](../learnings/1793673662074-slang-parser-parse-time-lookup-facts-for-disambigu.md):

- **Function bodies are parsed lazily.** `parseOptBody` (~2318) stores a Slang function body as an `UnparsedStmt` token list, parsed after the module-scope declarations exist. A parse-time lookup in a body (`_tryResolveDecl`, `isTypeName`, `_isCast`) therefore resolves a field declared after its method, a later global, and a later type (the first two confirmed on #14203 R2). "The parser cannot see a later declaration" holds only for declaration-level contexts. (The local declarator-group limit below is a separate, within-statement effect.)
- **`_tryResolveDecl` resolves only `VarExpr` and `StaticMemberExpr`.** It returns null for `MemberExpr` (`s.k`, `v.x`), `DerefMemberExpr` (`p->k`) and `ThisExpr`, so a "can this name a type?" predicate must handle members itself: `x.m` is a value if `x` resolves to a `VarDeclBase` or is itself a value; if `x` resolves to a type or namespace (`ns.T`), `x.m` may name a type. For an already-declared name, `_tryResolveDecl` plus `_isType` (as `_isCast` uses them) is the established type-or-value test [parser change review](../learnings/1793662836426-parser-change-review-compare-core-module-archives-.md).
- **Generic arguments inside declarations reach this code.** In `RWStructuredBuffer<int**> b;` the `int**` reaches `parsePostfixExpr` via `_parseGenericArg`; only a declaration's outermost type goes through `ParseType`.
- **Some expression kinds never name a type:** `InvokeExpr` (calls, casts, operators), `SizeOfLikeExpr`, `ParenExpr`, `LiteralExpr`. `GenericAppExpr` is not an `InvokeExpr`, and an `IndexExpr` names a type only if its base does (`int[3]`).

**Proving a parser change keeps existing meanings (#14203).** Build a "base" worktree that is the PR head with only the changed parser file from master, removing master-drift noise. Compile every `tests/**/*.{slang,hlsl}` to spirv-asm with both builds and compare rc, stderr and output, normalizing `/base/` vs `/head/` paths; drop hlsl files without an entry point (E00070 before parsing). Then compare the core module: `slang-bootstrap -compile-core-module -archive-type riff -save-core-module X.bin` with each build (riff-lz4 hides any diff). The archive is nondeterministic: two head runs differ in ~16 bytes near offset 21.96M, and a build hash at bytes 115–134 differs between builds; any other difference is real [parser change review: compare core-module archives and a revert-only base build](../learnings/1793662836426-parser-change-review-compare-core-module-archives-.md).

## Local declarator groups are invisible to parser-time lookup (#13428)

Consider these two statements in a function body:

```slang
int j = x, k = j < 2;            // E30015: j is not found while parsing k's initializer

typedef int T;
int T = x, m = (T) - 1;          // E30060: the global typedef T wins over the local T
```

`ParseDeclaratorDecl` (~:3857-3901) builds every `VarDecl` of the statement, but they join the scope (`AddMember` plus `DeclCheckState::ReadyForParserLookup`) only in `CompleteDecl` (~:5865/:5897), after the whole statement is parsed. Every parser-time lookup in a later declarator's initializer misses the earlier declarators: `tryParseGenericApp` → `CheckTerm` on `j <`, and `isTypeName`/`peekTypeName` for `(T)` casts. The first form is a regression since v2025.5 (#6281); #9561 fixed the same class for `if (let …)` [local decl groups are invisible to parser-time lookup](../learnings/1791148614375-slang-parser-local-decl-groups-are-invisible-to-pa.md).

The working prototype registers each declarator inside the declarator loop, in the Body stage only, and has `CompleteDecl` skip the later `AddMember` for those declarators. Three traps:

- **Doing the early add in every parsing stage** breaks the core-module bootstrap (InternalError in `getSpecializedBuiltinType`).
- **Gating the skip on `checkState`** let a decl be added twice, creating a `_prevInContainerWithSameName` self-cycle; lookup loops forever (17 GB RSS).
- **Gating the skip on `decl->parentDecl == containerDecl`** is not proof of membership. `ParseEnum` (~:6669) calls `pushScopeAndSetParent(decl)`, setting `parentDecl` before `CompleteDecl` calls `AddMember`, so the check silently drops every enum from its container. In the core module that unregisters the `__magic_enum` types (AddressSpace, AccessQualifier), and slang-bootstrap dies in `ASTBuilder::getSpecializedBuiltinType` ← `getPtrType` ← `visitPointerTypeExpr`. Key the skip on the path that did the early add (e.g. a `VarDeclBase` from the declarator loop) or check real membership. The failure looks like a missing Body-stage gate; rebuilding each variant separately isolated the cause [parentDecl == container is not proof of membership](../learnings/1791150138311-slang-parser-parentdecl-container-is-not-proof-of-.md).

When probing on current master, `slangc -target spirv -o /dev/null` gives E00004 (#13294), so write to a real output file [same](../learnings/1791148614375-slang-parser-local-decl-groups-are-invisible-to-pa.md).

## Local enums and `parseDeclBody` (#13434)

#13434 suspends `parser->semanticsVisitor` inside `parseDeclBody`. Reviewers A and C both flagged, from source alone, that a local `enum` keeps the visitor because `parseEnumDecl` uses `pushScopeAndSetParent` instead of `parseDeclBody`. Running the case disproves it: an `enum E { ... }` directly in a function body never reaches `parseEnumDecl` (the parser takes `enum` as an identifier: E30102 + E20001 + E30015 on master and head), and an enum nested inside a local struct goes through the struct's `parseDeclBody`, so it is covered (E30600 on master, compiles on head). When inner reviewers say a claim is "verified by code reading" because `slangc` was not approved, run the probe before passing it on. Runner note: Reviewer A with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` unset produced a 189-byte stub `final-review.md` (REVIEW-GUARD FAIL); rerunning with `=0` under `setsid` produced the full review [local enum bypassing parseDeclBody is unreachable](../learnings/1791179306916-reviewers-source-only-local-enum-bypasses-parsedec.md).

## Reopening `namespace A::B`: which scope the parser pushes (#13701, PR #13711)

This example tells the scope choices apart:

```slang
import lib;                                     // lib declares Outer::ImportedType
namespace Outer { struct Local { ImportedType t; }; }
namespace Outer { namespace Inner { } }
namespace Outer::Inner { }                      // Outer and Inner both exist already
```

When `parseNamespaceDecl` finds an existing `Inner`, it must push a scope for the enclosing `Outer` so the body sees `Outer`'s members. `Parser::PushScope(ContainerDecl*)` pushes a scope AND sets `containerDecl->ownedScope`, and `SemanticsDeclScopeWiringVisitor::visitNamespaceDecl` wires imported same-name namespaces onto `ownedScope->nextSibling`. An extra owning push on an existing namespace therefore moves `ownedScope`, and the earlier `namespace Outer` body loses the imported names (`ImportedType` gives E30015; the example compiles on master). PR #13711 added `Parser::pushLookupScope`, which pushes without assigning `ownedScope`; the parser uses it whenever it only needs lookup into an existing container [PushScope overwrites ownedScope; use a lookup-only push](../learnings/1792165813229-slang-parser-pushscope-overwrites-ownedscope-use-a.md).

The review of #13711 tested three choices with revert drills [three scope choices and the probe set that separates them](../learnings/1792168868666-slang-namespace-a-b-reopen-three-scope-choices-and.md):

1. **Lookup-only fresh scope** (`pushLookupScope`, merged). Fixes the repro; imported members of `A` stay invisible inside `A::B`, a pre-existing gap tracked as #13714.
2. **Owning `PushScope(A)`.** Fixes the #13714 shape, but an earlier `namespace A { ImportedType f; }` body fails with E30015, because `ownedScope` moves and the import wiring follows it.
3. **Parenting the body under `A->ownedScope` (borrow).** Fixes #13714 and keeps imports, but an earlier body's `using namespace X` leaks into `A::B`, which the nested spelling `namespace A { namespace B { ... } }` rejects on master and head.

Four probes separate them: the repro; an import with `B` already declared; an import used in an earlier `A` body; and `using namespace X` in an earlier `A` body.

The fix also changes behaviour: inside `A::B`, `A`'s members now hide a same-named global, as in the nested spelling, so a program that compiled before can silently get a different value (1000 → 30 in the review probe), a small source-breaking change, so check the label [same](../learnings/1792165813229-slang-parser-pushscope-overwrites-ownedscope-use-a.md). On #13711 the maintainer accepted it as a non-breaking bug fix toward the nested spelling [same](../learnings/1792168868666-slang-namespace-a-b-reopen-three-scope-choices-and.md); compare #13429 above, which the shepherd relabelled `pr: breaking change`.

## Regression tests that really guard parser lookup

A test row for a parser-lookup bug is masked when the same file declares a global with the same name. For #13428, a headline row `int j = buf[0], k = j < 2;` next to `static int j = 5;` (added for another row) compiles on master: lookup falls back to the global `j`, `<` is a comparison, and the row no longer guards the regression. Use headline-row names that nothing else in the file declares at global scope, and verify by compiling the row with the master binary with and without the global (found on PR #13432 by Reviewer C, C009). Tooling notes from the same review: `slang-pr-review-runner/scripts/*.sh` and `run-clarity.sh` can lose the exec bit after a restart (exit 126), so invoke them with `bash <script>`; new worktrees need `git -c protocol.file.allow=always submodule update --init --recursive`; grepping clarity `tool-uses.jsonl` for `slang-review-post-github` also matches Reads of the skill's own files, so inspect hits before calling it drift [a same-named global masks parser-lookup regressions in a test row](../learnings/1791175231268-slang-tests-a-global-with-the-same-name-masks-pars.md).

**Source learnings (17):**
- [Swizzle bases stay Unknown in body-stage tryParseGenericApp and hit the FOLLOW heuristic (#13426)](../learnings/1791128536486-slang-tryparsegenericapp-swizzle-bases-swizzleexpr.md) — classify by the checked base's type
- [Classify NonGeneric by as<DeclRefType>; reuse checkedBase only when kind != Unknown](../learnings/1791149609749-slang-tryparsegenericapp-classify-by-as-declreftyp.md) — in-place `visitMemberExpr` rewrite; `LetExpr`
- [Parser disambiguation changes get `pr: breaking change` even when only accepting rejected code (PR #13429)](../learnings/1791192194734-slang-maintainers-flag-parser-disambiguation-chang.md) — label edits don't re-trigger ci.yml
- [Local declarators join the scope only in CompleteDecl (#13428, E30015/E30060)](../learnings/1791148614375-slang-parser-local-decl-groups-are-invisible-to-pa.md) — Body-stage early add
- [ParseEnum sets parentDecl before AddMember, so a parentDecl-keyed skip drops every enum](../learnings/1791150138311-slang-parser-parentdecl-container-is-not-proof-of-.md) — breaks slang-bootstrap
- [A local enum in a function body is rejected at parse; the #13434 review claim is unreachable](../learnings/1791179306916-reviewers-source-only-local-enum-bypasses-parsedec.md) — probe source-only claims
- [A same-named global masks a parser-lookup regression row (#13432)](../learnings/1791175231268-slang-tests-a-global-with-the-same-name-masks-pars.md) — unique names; verify with master
- [`Parser::PushScope` sets `ownedScope`; use `Parser::pushLookupScope` (#13701, PR #13711)](../learnings/1792165813229-slang-parser-pushscope-overwrites-ownedscope-use-a.md) — owning push detaches imports (E30015)
- [Three scope choices for reopening `namespace A::B`, the four-probe set, #13714](../learnings/1792168868666-slang-namespace-a-b-reopen-three-scope-choices-and.md) — accepted non-breaking behaviour change
- [?: operand precedence: middle-operand widening is additive, third-operand is NOT](../learnings/1792684737065-slang-operand-precedence-middle-operand-widening-i.md) — DeepWiki inverted the precedence
- [?: last operand is parsed at the ?: level: `c ? x : y op= z` is `(c ? x : y) op= z`](../learnings/1792691643285-slang-the-last-operand-is-parsed-at-the-level-so-c.md) — middle-only fix (#13874) leaves E30047
- [?: last-operand precedence change is breaking for compound ops](../learnings/1792694250367-slang-last-operand-precedence-change-is-breaking-f.md) — user by-value `operator/=`; SP#027 comma rule
- [`parsePostfixExpr` `*` follow set is load-bearing for `T**` generic args; release-tarball bisect](../learnings/1793311726672-slang-parser-postfix-lookahead-is-load-bearing-for.md)
- [The `*`-run brief was wrong twice: EOF strings and `int**(x)`; A/B every rerouted token class](../learnings/1793320104546-slang-parser-lookahead-changes-a-b-every-token-cla.md)
- [Follow-set changes must include `EndOfFile` or `findTypeByName("int**")` returns NULL](../learnings/1793320137908-slang-parser-follow-set-changes-include-endoffile-.md) — cover the API path with a unit test
- [Parse-time lookup facts for disambiguation fixes (PR #14203)](../learnings/1793673662074-slang-parser-parse-time-lookup-facts-for-disambigu.md) — lazy `UnparsedStmt` bodies; `_tryResolveDecl` skips members
- [Parser change review: compare core-module archives and a revert-only base build](../learnings/1793662836426-parser-change-review-compare-core-module-archives-.md) — riff nondeterministic bytes; `_tryResolveDecl` + `_isType`

_Catalog: [[wiki/index.md]]_
