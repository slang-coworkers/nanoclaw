---
title: "Slang Parser: tryParseGenericApp Classification and Parser-Time Lookup"
type: concept
group: slang-language-core
tags: [parser, tryParseGenericApp, generic-app, CheckTerm, swizzle, DeclRefType, parser-lookup, CompleteDecl, AddMember, local-decl, enum, parseDeclBody, e39999, e30015, test-masking]
source_count: 7
---

# Slang Parser: tryParseGenericApp Classification and Parser-Time Lookup

How the Slang parser decides whether `name <` opens a generic application or is a less-than comparison, and the parser-time scope lookup that decision depends on. The page collects the October 2026 cluster: #13426 (swizzle bases, PR #13429), #13428 (local declarator groups, PR #13432), and the #13434 review of suspending `parser->semanticsVisitor` in `parseDeclBody`. Related: the decl-vs-statement and language-server-suite rules on [[wiki/concepts/slang-compiler-frontend-and-checking.md]], and the #12892 `tryParseGenericApp` merge calibration on [[wiki/concepts/review-approver-merge-join-calibration.md]].

## TL;DR

- In body-stage parsing, `tryParseGenericApp` runs `CheckTerm` on the expression before `<` and classifies the checked base. Any base it leaves `Unknown` falls back to the old FOLLOW-set heuristic, which misparses comparisons such as `uv.y < a || uv.y > (a)` as a generic app (E39999).
- Classify a checked base as NonGeneric with the positive test `as<DeclRefType>(checkedBase->type.type)`. Every run-time value type derives from `DeclRefType`; kind-like types (TypeType, NamespaceType, FuncType, GenericDeclRefType, OverloadGroupType), ErrorType and a null type do not. A new Type kind therefore stays Unknown by default, which is safer than an exclusion list.
- Reuse the checked base only when its kind is not Unknown. `visitMemberExpr` rewrites `baseExpression` in place, so re-checking the raw expression gives false errors (E30101 on `p->y`). Unconditional reuse is also wrong: `h.o.get<3>()` checks to a `LetExpr`, which generic-overload candidate collection rejects.
- Decl-stage expressions (global initializers) have no semantics visitor and still use the heuristic, even for plain names.
- The declarators of one local statement (`int a = …, b = …;`) enter the scope only in `CompleteDecl`, after the whole statement is parsed. A later declarator's initializer therefore cannot see earlier ones through parser-time lookup (`tryParseGenericApp`, `isTypeName`/`peekTypeName`), giving E30015, or letting a shadowed global type or generic win.
- An early-registration fix must be Body-stage only, because doing it in every stage breaks the core-module bootstrap.
- The later `AddMember` skip must be keyed on the specific early-add path. Keying it on `checkState` adds the decl twice, creating a `_prevInContainerWithSameName` self-cycle and an infinite lookup. Keying it on `decl->parentDecl == containerDecl` drops every enum, because `ParseEnum` sets `parentDecl` before `AddMember`.
- A slang-bootstrap InternalError in `getSpecializedBuiltinType` after a parser change looks like a stage-gating problem. It can be lost core-module `__magic_enum` types instead, so rebuild each variant separately to isolate the cause.
- A local `enum` written directly in a function body never reaches `parseEnumDecl`; the parser takes `enum` as an identifier and rejects it (E30102 + E20001 + E30015). An enum nested in a local struct is parsed through that struct's `parseDeclBody`. Probe any source-only reviewer claim about a local-enum path before relaying it.
- A regression row for a parser-lookup bug must use names that nothing else in the test file declares at global scope. A same-named global makes the lookup fall back to it, so the row compiles on master and no longer guards the bug. Verify each headline row with a master binary, both with and without the global.
- Before attributing full-suite failures to a parser change, rerun exactly the failing set with the change reverted. A local run can carry about 30 pre-existing failures (a stale standard-module build, gfx-smoke without a GPU).
- Label a parser or disambiguation change that alters which programs are accepted `pr: breaking change` by default (or say the label is a judgement call), even when no previously-valid program changes meaning. If a maintainer relabels it, accept and reply with a measured master-vs-branch exposure table.
- A/B probes against a master `slangc` catch checked-base reuse pitfalls in under a minute. Give probes a real `-o` file, because `-o /dev/null` gives E00004 on current master (#13294).

## How tryParseGenericApp classifies the base of `name <` (#13426, PR #13429)

Consider this example:

```slang
float f(float2 uv, float a)
{
    return (uv.y < a || uv.y > (a)) ? 1.0 : 0.0;
}
```

In a function body, `tryParseGenericApp` (`slang-parser.cpp` ~:2985) calls `CheckTerm` on `uv.y` before deciding what `<` means. Before the fix it classified only a `DeclRefExpr` (a `MemberExpr` is one) and an `OverloadedExpr`. A checked base that is a `SwizzleExpr` (vector `uv.y`, scalar `a.x`, tuple `t._0`) or a `MatrixSwizzleExpr` (`m._m00`) stayed `Unknown` and fell through to the old FOLLOW-set heuristic. That heuristic sees `< a || uv.y >` followed by `(` and builds a generic app, which ends in E39999. The same comparison on a struct field (`s.y`) worked, and plain names had been fixed by #6281. Decl-stage parsing (global initializers) has no semantics visitor, so it still uses the heuristic for every shape, including plain names [tryParseGenericApp: swizzle bases bypass the body-stage classification](../learnings/1791128536486-slang-tryparsegenericapp-swizzle-bases-swizzleexpr.md).

The fix classifies the checked base by its type, not by its expression node. Both investigations reached that shape; the merged form is one positive branch, `else if (as<DeclRefType>(checkedBase->type.type)) baseKind = NonGeneric;`, which also covers tuple elements and existential members. An exclusion list (anything not TypeType/FuncType/GenericDeclRefType/OverloadGroupType/ErrorType/NamespaceType) gives the same result today. The positive test is preferred because all run-time value types derive from `DeclRefType`, while kind-like types, `ErrorType`, and the null type of a `PartiallyAppliedGenericExpr` do not. A Type kind added later therefore defaults to `Unknown` rather than being silently treated as a value. A 12-line prototype fixed every body shape with no new full-suite failures [as<DeclRefType> classification and the checkedBase reuse pitfalls](../learnings/1791149609749-slang-tryparsegenericapp-classify-by-as-declreftyp.md).

Reusing the already-checked base (the reuse #12892 introduced) has two pitfalls, and both appeared within a minute of an A/B against a master `slangc`. First, `visitMemberExpr` rewrites `expr->baseExpression` in place. Returning the raw `MemberExpr` after `CheckTerm` checks it a second time, and `p->y` with `float2* p` then reports a false E30101, so the reuse must widen to every `baseKind != Unknown`. Second, the reuse must not be unconditional: `h.o.get<3>()`, where `o` is an interface-typed field, checks to a `LetExpr`, which `AddGenericOverloadCandidates` rejects with E39999 [same](../learnings/1791149609749-slang-tryparsegenericapp-classify-by-as-declreftyp.md).

A local full `slang-test` run can show about 30 pre-existing failing files (a stale `slang.numerics` standard-module build, gfx-smoke without a GPU). Rerun exactly that set with the change reverted before attributing any of them to the parser change [same testing note](../learnings/1791128536486-slang-tryparsegenericapp-swizzle-bases-swizzleexpr.md).

## Labelling parser disambiguation changes `pr: breaking change`

PR #13429 was opened as `pr: non-breaking` because probes found no program that compiled before and changed meaning; what changed was that code which used to error now compiles (`uv.y<2>(3)` now parses as `(uv.y<2)>(3)`) and some diagnostics differ. The shepherd (skiminki-nv) relabelled it `pr: breaking change` because there was "at least a theoretical chance that this fix breaks existing code". For any parser or disambiguation change that alters which programs are accepted, default to `pr: breaking change` or say in the PR body that the label is a judgement call; when a maintainer flags the label, accept it and reply with a short measured exposure table (master vs. branch, per spelling) rather than arguing. Editing the PR body or labels does not re-trigger `ci.yml` (its `pull_request` types are opened/synchronize/reopened/ready_for_review), so status text can be fixed while CI runs on a held head ([maintainers flag parser disambiguation changes as `pr: breaking change` even when they only accept previously-rejected code](../learnings/1791192194734-slang-maintainers-flag-parser-disambiguation-chang.md)).

## Local declarator groups are invisible to parser-time lookup (#13428)

Consider these two statements in a function body:

```slang
int j = x, k = j < 2;            // E30015: j is not found while parsing k's initializer

typedef int T;
int T = x, m = (T) - 1;          // E30060: the global typedef T wins over the local T
```

`ParseDeclaratorDecl` (`slang-parser.cpp` ~:3857-3901) builds every `VarDecl` of the statement, but they are added to the scope (`AddMember` plus `DeclCheckState::ReadyForParserLookup`) only later, in `CompleteDecl` (~:5865/:5897), after the whole statement is parsed. Every parser-time lookup inside a later declarator's initializer misses the earlier declarators. That includes `tryParseGenericApp` → `CheckTerm` on `j <`, and `isTypeName`/`peekTypeName` for `(T)` casts. The first form is a regression since v2025.5 (#6281). #9561 fixed the same class for `if (let …)` [local decl groups are invisible to parser-time lookup](../learnings/1791148614375-slang-parser-local-decl-groups-are-invisible-to-pa.md).

The prototype that works registers each declarator inside the declarator loop, in the Body stage only, and has `CompleteDecl` skip the later `AddMember` for those declarators. It has three traps:

- **Doing the early add in every parsing stage** breaks the core-module bootstrap (InternalError in `getSpecializedBuiltinType`).
- **Gating the skip on `checkState`** let a decl be added twice. That creates a `_prevInContainerWithSameName` self-cycle, and lookup loops forever (17 GB RSS).
- **Gating the skip on `decl->parentDecl == containerDecl`** is not proof of membership. `ParseEnum` (~:6669) calls `pushScopeAndSetParent(decl)`, which sets `enumDecl->parentDecl` before `CompleteDecl` calls `AddMember(containerDecl, decl)`. The check therefore silently drops every enum from its container. In the core module that unregisters the `__magic_enum` types (AddressSpace, AccessQualifier), and slang-bootstrap dies with an InternalError in `ASTBuilder::getSpecializedBuiltinType` ← `getPtrType` ← `visitPointerTypeExpr` ← `visitParamDecl`. Key the skip on the path that did the early add (for example a `VarDeclBase` from the declarator loop), or check real membership. The failure looks like a missing Body-stage gate; rebuilding each variant separately is what isolated the real cause [parentDecl == container is not proof of membership](../learnings/1791150138311-slang-parser-parentdecl-container-is-not-proof-of-.md).

When probing on current master, `slangc -target spirv -o /dev/null` gives E00004 (#13294), so write to a real output file [same](../learnings/1791148614375-slang-parser-local-decl-groups-are-invisible-to-pa.md).

## Local enums and `parseDeclBody` (#13434)

#13434 suspends `parser->semanticsVisitor` inside `parseDeclBody`. Reviewer A and Reviewer C both flagged, from source alone, that a local `enum` keeps the visitor because `parseEnumDecl` uses `pushScopeAndSetParent` instead of `parseDeclBody`. Running the case disproves it. An `enum E { ... }` written directly in a function body never reaches `parseEnumDecl`: the parser takes `enum` as an identifier and reports E30102 + E20001 + E30015 on both master and head. An enum nested inside a local struct is parsed through the struct's `parseDeclBody`, so it is covered (E30600 on master, compiles on head). When inner reviewers say a claim is "verified by code reading" because `slangc` was not approved, run the probe before passing the claim on. A runner note from the same review: Reviewer A run with `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS` unset produced a 189-byte stub `final-review.md` (REVIEW-GUARD FAIL); rerunning with `=0` under `setsid` produced the full review [local enum bypassing parseDeclBody is unreachable](../learnings/1791179306916-reviewers-source-only-local-enum-bypasses-parsedec.md).

## Regression tests that really guard parser lookup

A test row for a parser-lookup bug is masked when the same file also declares a global with the same name. For #13428, a headline row `int j = buf[0], k = j < 2;` next to `static int j = 5;` (added for another row) compiles on master: the lookup falls back to the global `j`, `<` is taken as a comparison, and the row no longer guards the regression. Use names in the headline row that nothing else in the file declares at global scope, and verify by compiling the row with the master binary both with and without the global. This was found on PR #13432 (Reviewer C, C009) and confirmed with the master `slangc` [a same-named global masks parser-lookup regressions in a test row](../learnings/1791175231268-slang-tests-a-global-with-the-same-name-masks-pars.md).

Tooling notes from the same review: `slang-pr-review-runner/scripts/*.sh` and `run-clarity.sh` can lose the exec bit after a restart (exit 126), so invoke them with `bash <script>`. New worktrees need `git -c protocol.file.allow=always submodule update --init --recursive`, because file transport is blocked by default. When grepping clarity `tool-uses.jsonl` for `slang-review-post-github`, Reads of the skill's own files also match, so inspect the hits before calling it drift [same](../learnings/1791175231268-slang-tests-a-global-with-the-same-name-masks-pars.md).

**Source learnings (7):**
- [swizzle/matrix-swizzle bases stay Unknown in body-stage tryParseGenericApp and hit the FOLLOW heuristic (#13426, E39999); classify by the checked base's type](../learnings/1791128536486-slang-tryparsegenericapp-swizzle-bases-swizzleexpr.md)
- [classify NonGeneric by as<DeclRefType>; reuse checkedBase only when kind != Unknown (visitMemberExpr in-place rewrite; LetExpr from h.o.get<3>())](../learnings/1791149609749-slang-tryparsegenericapp-classify-by-as-declreftyp.md)
- [parser disambiguation changes get `pr: breaking change` even when they only accept previously-rejected code (PR #13429); label edits don't re-trigger ci.yml](../learnings/1791192194734-slang-maintainers-flag-parser-disambiguation-chang.md)
- [local declarators join the scope only in CompleteDecl, so later initializers miss earlier ones (#13428, E30015/E30060); Body-stage early add](../learnings/1791148614375-slang-parser-local-decl-groups-are-invisible-to-pa.md)
- [ParseEnum sets parentDecl before AddMember, so a parentDecl-keyed skip drops every enum and breaks slang-bootstrap](../learnings/1791150138311-slang-parser-parentdecl-container-is-not-proof-of-.md)
- [a local enum in a function body is rejected at parse, so the "bypasses parseDeclBody" review claim on #13434 is unreachable; probe source-only claims](../learnings/1791179306916-reviewers-source-only-local-enum-bypasses-parsedec.md)
- [a same-named global masks a parser-lookup regression row (#13432); use unique names and verify with master](../learnings/1791175231268-slang-tests-a-global-with-the-same-name-masks-pars.md)
_Catalog: [[wiki/index.md]]_
