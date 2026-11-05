---
type: triage
title: "Triage: shader-slang/slang#14295 — instance methods from an extension on a pointer type are not found on a pointer value"
description: Checker eagerly derefs `p` in `p.g()` before lookup, so lookup only sees the pointee; extension members on Ptr<T> are unreachable. Recommend retry-on-failure against the un-dereferenced Ptr type.
tags: [triage, frontend, lookup, pointer, extension]
---

# Triage: shader-slang/slang#14295 — Instance methods from an extension on a pointer type are not found on a pointer value
Date: 2026-11-04 | bug | medium | P2 normal | frontend (semantic checker: member-expr / lookup) | Duplicate: no

## What's broken
`extension Ptr<int> { int g() { return 1; } }` then `Ptr<int> p; p.g();` → `error[E30027]: 'g' is not a member of 'int'`.
Same for `extension<T> Ptr<T>`, `extension Ptr<S>`, `extension int*`, `extension Ptr<int> : IThing` + `p.f(q)`, and `p->g()`.
Works: static `Ptr<int>.g()`, `extension W<int>` on a plain struct + `w.g()`, generic `callF<T:IThing>(p, q)`.
Reporter jkwak-work (MEMBER, assignee) asked "@nv-slang-bot can you triage and make a pr?" (cmt 6636111507).

## Repro (FACT — reproduced on master 3da6f63c0 with wt-14307-master/build/Release/bin/slangc, 2026.21-5-g3da6f63c0)
```
slangc a.slang -target cpp -entry main -stage compute   # a.slang = the snippet above
```
All 5 failing forms + `p->g()` fail (exit 255); the 3 working forms exit 0. Repro files: /tmp/14295/*.slang (ephemeral).
Shadow probe: `struct S { int g() {return 2;} }; extension Ptr<S> { int g() {return 1;} }; p.g()` picks `S::g` today.
Note: main-checkout Debug build at 3da6f63c0 fails at `objcopy --only-keep-debug ... [.debug_str]: invalid operation`
(link step of libslang-without-embedded-core-module.so) — infra, not code; Release build in wt-14307-master was used.

## Codebase digest (FACT, read at 3da6f63c0)
- `source/slang/slang-check-expr.cpp:9467` `visitMemberExpr` → `checkBaseForMemberExpr` (:9384) → `maybeInsertImplicitOpForMemberBase` (:9323) → `maybeDereference` (:8417) at :9367.
  `maybeDereference` loops on `getPointedToTypeIfCanImplicitDeref` (slang-check-type.cpp:24) and skips `PtrType` ONLY for `CheckBaseContext::Subscript` (:8423-8426). So `p` becomes `*p : int` before any lookup.
- `checkGeneralMemberLookupExpr` (:9405) calls `lookUpMember(..., baseType=int)` → empty → `lookupMemberResultFailure` (:9313) → E30027 against `int`.
- Lookup already has a pointee-first → pointer-itself fallback: `slang-lookup.cpp:587-607` derefs with a `Deref` breadcrumb, returns only `if (ioResult.isValid())`; else :612-623 looks in `DeclRefType` Ptr<int> via `_lookUpMembersInSuperTypeDeclImpl` → facets incl. extensions. The `if valid return` was added by csyonghe in 5290c5806 (#6028, DescriptorHandle). That fallback is DEAD for member exprs because the checker already derefed.
- The static path `_lookupStaticMember` uses `lookUpMember(..., LookupOptions::NoDeref)` (:8907-8914) → finds `Ptr<int>.g`. Generic path: `T` is a GenericTypeParam, not PtrType → no deref → works.
- `ConstructLookupResultExpr` already turns a `Deref` breadcrumb into `ConstructDerefExpr` (:964).
- `PtrType : PtrTypeBase : BuiltinType : DeclRefType` (slang-ast-type.h:892/866/141). `DescriptorHandleType : PointerLikeType` (:529) → `constructDerefExpr` coerces to T (:691-698).
- Swizzle dispatch in `visitMemberExpr` (:9491-9516) depends on the DEREFED base type (e.g. `Ptr<float4> p; p.xy`).
- `->` (`DerefMemberExpr`) goes through the same path; diagnostic at :9473 uses `needDeref`.

## History / precedent
- #10962 (DescriptorHandle<T> instance member lookup searches T): closed by kaizhangNV 2026-04-27 as BY DESIGN — "we will not allow to call the member method of DescriptorHandle<T>, dereference of DescriptorHandle<T> will always direct to call T's method." Bot PR #10963 (skip eager deref for PointerLikeType in Member context + lookup own-members-first) closed unmerged. Scope of that decision = DescriptorHandle, not `Ptr<T>`.
- #7656/#7719 (243f522a9): segfault with `This` in `extension Ptr<int> : IThing`; added `NoDeref` for lookup inside extension scopes (`_lookUpInScopes` ~:940-959) and test `tests/bugs/ptr-extension-this-type.slang`, whose `p.f(other)` never compiled; `CHECK: 1` matched `result code = 1`.
- #14299 (jkwak-work, OPEN): disables that test (`//DISABLE_TEST:INTERPRET` + `TODO(#14295)`). Not on master yet. (#14269 = SIMPLE-exit-code sibling.)
- Docs: docs/user-guide/03-convenience-features.md:614 "operator `.` can also be used to dereference a member from a pointer" — silent on extension members of the pointer type.

## Is this by design? (judgment: NO for Ptr<T>)
1. Lookup has an explicit pointee-then-pointer fallback (:587-623) — the design intends pointer-own members to be reachable; the checker's eager deref makes it unreachable.
2. `extension Ptr<int> : IThing` is accepted and works via generics; a conformance whose method can't be called on a value of the conforming type is inconsistent.
3. #7719's test was written expecting `p.f(other)` to compile with `This == Ptr<int>`.
4. The #10962 decision is DescriptorHandle-specific (a transparent handle for T). `Ptr<T>` is a first-class value type.
Risk: kaizhangNV may want Ptr consistent with DescriptorHandle → cite #10962 in the PR so reviewers can weigh in.

## Candidate approaches
### A: Retry on the un-dereferenced pointer type when pointee lookup fails (RECOMMENDED)
- Where: slang-check-expr.cpp `visitMemberExpr` (:9467) / `checkGeneralMemberLookupExpr` (:9405); keep the pre-deref base out of `checkBaseForMemberExpr`/`maybeInsertImplicitOpForMemberBase` (:9323-9393).
- Delta: if `.` (not `->`) base was implicitly derefed from a `PtrType`, and lookup on the pointee is empty, `lookUpMember(..., ptrType, ..., NoDeref)`; if found, build the lookup-result expr on the ORIGINAL pointer expr (so `this`/`This` = Ptr<int>). Pointee members keep priority (same order as lookup's own fallback).
- Tradeoffs: only programs that error today change; swizzle/existential/autodiff paths untouched. Second place that encodes "pointee first, then pointer" (lookup :587-623 also does) — say so in the PR.
- Risk: low. Must exclude DescriptorHandle (#10962) and `->`; diagnostic when both fail should still name the pointee (current text).
### B: Stop eager deref for PtrType in Member context; let lookup's breadcrumb deref do it
- Where: `maybeDereference` (:8417) add Member skip for `PtrType` (like Subscript) + `visitMemberExpr` swizzle/existential handling.
- Delta: lookup (:587-623) is the single source of truth for ordering; `ConstructLookupResultExpr` (:964) inserts the deref.
- Tradeoffs: principled single source, but must re-route swizzles (`Ptr<float4> p; p.xy`, scalar `p.x`), `maybeOpenExistential` for `Ptr<IFoo>`, tuple swizzle, differentiable-type registration on the deref type, and the `->` diagnostic (needDeref). Wider blast radius; close to the closed #10963 shape.
- Risk: medium — pointer tests (tests/language-feature/pointer/*, types/pointer-basic-operations.slang) and swizzle-through-pointer regressions.
### C: Declare by design — better diagnostic + docs
- Where: `lookupMemberResultFailure` (:9313) note + user-guide pointer section.
- Rejected as primary: contradicts lookup's existing fallback and the accepted `extension Ptr<int> : IThing` conformance; maintainer-reporter asked for a fix PR.

## Recommended path (solution brief)
- Hypothesis: `maybeDereference` (slang-check-expr.cpp:8417, via :9367) replaces `p` with `*p` before lookup; lookup's pointer fallback (slang-lookup.cpp:612-623) never runs.
- Fix (A): in `visitMemberExpr`, for a `.` access whose base was implicitly derefed from a `PtrType`, when lookup on the pointee finds nothing, retry `lookUpMember(..., <Ptr type>, ..., LookupOptions::NoDeref)` and build the result on the un-dereferenced base. Exclude `->` and DescriptorHandle (#10962).
- Repro: `slangc a.slang -target cpp -entry main -stage compute` (snippet above) → must compile.
- Acceptance: (1) all 5 failing forms from the issue compile & run; (2) `tests/bugs/ptr-extension-this-type.slang` passes for real (strengthen CHECK so it can't match `result code = 1`, e.g. `CHECK: result=1`; undo #14299's DISABLE_TEST if it has landed, else coordinate with jkwak-work); (3) new test covering `Ptr<int>`/`int*`/generic `extension<T> Ptr<T>`/`Ptr<S>` instance calls + pointee-member-wins shadow case; (4) `p->g()` still errors; DescriptorHandle behaviour unchanged; (5) tests/language-feature/pointer/ + extensions/ + full slang-test no new failures; (6) optional doc line in 03-convenience-features.md pointers section.

## Sources
- DeepWiki Q1: member access derefs in maybeDereference before lookup; extension-scope lookup uses NoDeref. Q2: no fallback to the un-dereferenced type in member-expr checking.
- gh: #10962 + PR #10963 (closed), #7656/#7719, #14299 (disables test), #14269.
- Recall: no prior hits on this bug; nearest maps triage-12873.md (maintainer pushed fix out of lookup into check files), triage-11472.md.
