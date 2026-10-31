---
title: "Slang new semantic checks: unmarked compiler-made declarations and twice-visited bodies"
type: concept
group: slang-language-core
tags: [slang, semantic-checking, SynthesizedModifier, lambda, maybeCaptureDecl, LambdaDecl, InterfaceDefaultImplDecl, ASTSynthesizer, emitVarDeclStmt, bitfield, SetterDecl, extendContainerDecl, autodiff, shadowing, E30515, E30022, language-server, semantic-tokens]
source_count: 3
---

# Slang new semantic checks: unmarked compiler-made declarations and twice-visited bodies

A new per-declaration or per-block check in the Slang semantic checker sees more than the user's code. The motivating case is the generic-parameter shadowing check of shader-slang/slang PR #14093, which widens E30515 (the existing gap is on [Slang Scope Lookup, Function-Local Types, and Declaration Checking](../concepts/slang-language-scope-lookup-and-declaration-checking.md)). Some declarations that the compiler makes carry no `SynthesizedModifier`, and two kinds of body are visited twice. Both give diagnostics on valid code: duplicates, reports with no location, or, once the check is an error in Slang 202c, a failure on code that compiled before.

## TL;DR

- `SynthesizedModifier` is not on every compiler-made declaration. PR #14093 found these unmarked producers: lambda capture fields (`maybeCaptureDecl`), `ASTSynthesizer::emitVarDeclStmt` locals (`result` in the synthesized `dzero`/`dadd`, `S_synth_loop_index`), a bitfield's synthesized `SetterDecl` and its implicit `newValue`, and the autodiff `ExtensionDecl` from `extendContainerDecl` (it holds the `BwdCallable` and `MinimalContext` aliases).
- A diagnostic on one of these has no location (line 0, col 0) or points into `core`.
- Fix at the producer: mark the declaration where it is made. The readers of `SynthesizedModifier` (LSP filters, `shouldDocumentDecl`, `isSynthesizedMethod`, the FuncDecl-only `in` default) do not change behavior for these kinds.
- Exception: lambda capture fields. Marking them removes LSP semantic-token highlighting from captured names, so the check skips members whose parent `AggTypeDeclBase` is synthesized instead.
- Find unmarked producers by fuzzing: grep `getName("…")` in `slang-check-*.cpp` and `slang-ast-synthesis.cpp`, name a generic parameter after each string, compile it on a differentiable struct, a `[Differentiable]` method and a bitfield, and diff against master.
- An interface method with a body is parsed twice, into the requirement and an `InterfaceDefaultImplDecl`. Its params and generic params exist twice at one location, and neither copy is marked. Skip the signature decls whose parent chain reaches an `InterfaceDefaultImplDecl`.
- A block-bodied lambda's `BlockStmt` is checked twice: in `visitLambdaExpr`, then as the body of the synthesized `()` method. Locals are safe; a loop over `scopeDecl` members is not. Report on the first visit.
- Normal tests never check warnings. Only a 202c error run or an exhaustive DIAGNOSTIC_TEST shows these false reports, so test both twice-visited shapes and the synthesized-name cases for every new check on params, generic params or block contents.

## Compiler-made declarations without `SynthesizedModifier`

**Lambda capture fields.** `maybeCaptureDecl` (`slang-check-expr.cpp`) makes one `VarDecl` field for each captured variable inside the lambda's `LambdaDecl`, and copies the captured declaration's `nameAndLoc`. The `LambdaDecl` carries `SynthesizedModifier`; the fields do not. Consider `struct S { int g<let K:int>() { let l = () => K; ... } }`: the closure type gets a field `K` with the user's name and location, so a shadowing, naming or redeclaration-like check over members reports it. The check skips members whose parent `AggTypeDeclBase` is synthesized (`getParentDecl` plus `hasModifier<SynthesizedModifier>`). Marking each capture field looks like the producer-side fix, but `slang-language-server-semantic-tokens.cpp` skips references to synthesized declarations, so captured names in lambda bodies would lose their highlighting. A `/code-review` pass found this after the full suite was green ([lambda capture fields are not SynthesizedModifier-marked](../learnings/1793366451861-slang-lambda-capture-fields-copy-the-captured-name.md)). A separate trap with the same fields: a capture field must not borrow a type's name such as `This` ([[wiki/concepts/misc-f0909b9-slang-compiler-internals.md]]).

**Other unmarked producers, and the producer-side fix.** A check that skips `SynthesizedModifier` declarations still sees:

- locals from `ASTSynthesizer::emitVarDeclStmt`, which get no modifier and no location, for example `result` in the synthesized `dzero`/`dadd` of an `IDifferentiable` struct, and `S_synth_loop_index`;
- a bitfield's synthesized `SetterDecl` (made in the `visitStructDecl` modifiers), and the implicit `newValue` that `visitSetterDecl` gives it;
- the autodiff extensions that `extendContainerDecl` builds, whose `TypeAliasDecl`s `BwdCallable` and `MinimalContext` (`slang-check-decl.cpp` around :16166 and :17554) are unmarked.

These diagnostics have no source location or point into `core`, and in a strict mode they fail valid code. To find them, list the names the checker synthesizes (`grep -o 'getName("…")' slang-check-*.cpp slang-ast-synthesis.cpp`), compile a generic parameter named after each one (`struct G<let NAME : int> : IDifferentiable {…}`, a `[Differentiable]` method, a bitfield) and compare with master. The fix marks the `VarDecl` in `emitVarDeclStmt`, marks the bitfield setter and propagates the mark to its `newValue`, and marks the `ExtensionDecl` in `extendContainerDecl`; a "members of a synthesized type" skip then covers the aliases. The other readers of `SynthesizedModifier` are the LSP filters, `shouldDocumentDecl`, `isSynthesizedMethod` (which needs an `AggTypeDeclBase` parent) and the FuncDecl-only `in` default, so these marks are low-risk, and the full suite stays green ([unmarked compiler-made decls; fuzz generic-param names against synthesized names](../learnings/1793377375556-checks-that-skip-slang-compiler-made-declarations-.md)).

## Bodies the checker visits twice

**Interface method with a body.** `parseInterfaceDefaultCallableAsExplicitGeneric` (`slang-parser.cpp` ~6464) parses the method a second time into an `InterfaceDefaultImplDecl`. Its `ParamDecl`s and generic params therefore exist twice at the same source location, and neither copy carries `SynthesizedModifier`. Master already reports E30515 twice for `interface I<T> { int h<T>() { return 0; } }`. The fix skips the signature decls whose callable or generic parent chain reaches an `InterfaceDefaultImplDecl`: the requirement copy keeps the signature, and body locals exist only in the default copy.

**Block-bodied lambda.** `visitLambdaExpr` runs `dispatchStmt(bodyStmt)` with `m_parentLambdaExpr` set, and then the same `BlockStmt` is checked again as the body of the synthesized `()` `FuncDecl`, so code in `visitBlockStmt` runs twice. Locals are safe, because the declaration state machine runs once for each decl; a loop over `scopeDecl` members is not. Detect the second visit with `!m_parentLambdaExpr && getParentFunc() && as<LambdaDecl>(getParentFunc()->parentDecl)`, and report on the first visit: diagnostics from the second visit get an extra `note[E30022]: ... while synthesizing method '()' of '_slang_Lambda_...'` ([interface default bodies and lambda bodies are seen twice](../learnings/1793371675023-slang-ast-interface-default-bodies-and-lambda-bodi.md)).

The same class of bug in expressions is the non-idempotent `visitMemberExpr` re-check behind `foo->Bar<T>()` E30101 ([[wiki/concepts/misc-f0909b9-slang-compiler-internals.md]]): when a check fails in only one syntactic combination, suspect a second visit.

## Testing a new check

Ordinary tests do not look at warnings, so a check that fires on synthesized or twice-visited declarations passes the full suite. Run the check as a 202c error, or pin it with an exhaustive `DIAGNOSTIC_TEST`, and include an interface method with a body, a block-bodied lambda that captures a generic value parameter, and a generic parameter named after each synthesized name. When the 202c error text extends the warning text, a message-only annotation matches both severities; pin the severity and code on the primary row ([[wiki/concepts/misc-f0909b9-slang-diagnostics-warnings-and-test-authoring.md]]).

**Source learnings (3):**
- [Slang lambda capture fields copy the captured name but are not SynthesizedModifier-marked](../learnings/1793366451861-slang-lambda-capture-fields-copy-the-captured-name.md) — `maybeCaptureDecl` fields carry the user's name and loc; skip members of a synthesized `AggTypeDeclBase`; marking the fields breaks LSP semantic tokens.
- [Slang AST: interface default bodies and lambda bodies are seen twice](../learnings/1793371675023-slang-ast-interface-default-bodies-and-lambda-bodi.md) — `InterfaceDefaultImplDecl` duplicates signature decls; a block lambda body is checked in `visitLambdaExpr` and again in the synthesized `()`; report on the first visit.
- [Checks that skip Slang compiler-made declarations need the marker at every producer](../learnings/1793377375556-checks-that-skip-slang-compiler-made-declarations-.md) — `emitVarDeclStmt`, bitfield setter + `newValue`, `extendContainerDecl` aliases are unmarked; fuzz generic-param names against `getName("…")`; mark at the producer.
