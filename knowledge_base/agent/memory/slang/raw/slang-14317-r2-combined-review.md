---
type: source
description: "slang-reviewer R2 combined review of PR #14317 (fixes #14295), 2026-11-04 21:30Z, head d7b13fd: APPROVE_WITH_NITS, B1 fixed, tests-only nits-14317-r2.patch + comment nits N2-N5. Verbatim memo; distilled into slang/14295-ptr-extension-instance-method-lookup.md."
okf_synth: exempt
---
# Combined PR Review — shader-slang/slang#14317 (pr, round 2, head d7b13fd)

## Reviewer verification (slang-reviewer, own runs) — round 2

**Verdict: APPROVE_WITH_NITS.** B1 is fixed and verified. The R1 gaps are closed: the three test files match my R1 remedy except for comment wording. The source is the remedy plus the R1 comment and contract changes; the only change to the remedy code is that callers pass `nullptr` explicitly instead of relying on default parameters. Reviewer A finds 0 bugs. I tried each of A's two new gaps on d7b13fd and the compiler already does the right thing; only the tests are missing. Apply `nits-14317-r2.patch` (+85/−1, tests only, tested) and the comment nits N2–N5, then send the `[Fix Report]`. Another review round is not needed.

### What I ran

- `wt-14317-verify` was rebuilt at d7b13fd: a Release build with `touch` on the two checker files, then an incremental STATIC build.
- `wt-14317-base` (master 3da6f63c0) is unchanged since R1. Both trees use the same `libslang-llvm.so` (c680a7be).
- CI on the PR is still skipped because it is a draft.

| Check | d7b13fd | Master |
|---|---|---|
| Related dirs (`extensions/`, `dynamic-dispatch/`, the 2 PR diag/bug tests) | 775/775 | — |
| Full `slang-test -server-count 8` | 11517/11520; only `fp8-cuda{,-e5m2,-half-acc}` fail, and they fail on master too | — |
| `slang-static-unit-test` | 61 / 0 / 6 ignored | — |
| B1 `nextEntry().tag()` and `.tag2()` | `nextEntry` runs once | E30027 |
| `extension<T : IFoo> T { extra }` vs a Ptr `extra`, `pFoo.extra()` | 7 (pointee wins) | 7 |
| clang-format 17 on the changed C++ | clean | — |
| `nits-14317-r2.patch` pins | 4/4 (cpu/vk/cuda + diag) | the new diag test finds 8 unannotated errors |

### Findings

**N1 (A gaps 1–2): behaviour is correct, only the tests are missing. Apply `nits-14317-r2.patch`.** Results on d7b13fd:

| Form | Result |
|---|---|
| `(p + 1).advance()` | E30050 (rvalue base) |
| `cb.advance()` on `ConstantBuffer<Ptr<int>>` | E30050 |
| `ps.m()` with `private S.m` and `extension Ptr<S>.m` | E30600, so the pointee member hides the pointer level, as the new comment says |
| `pf->tag()` on `IFoo*` | E30027, because `->` excludes `Ptr<IFoo>` (`pf.tag()` works) |
| `p::answer()` | E30027, because `::` is not searched, as the new comment says |
| `p.answer()` (static, through the instance) | 77 |
| `[nonmutating] set` through `pp.value = 33` | writes `intPtr[3]` |

The patch puts the last two in `ptr-extension-instance-member.slang` and the others in a new `tests/diagnostics/pointer-extension-member-rebound-base.slang`. Without the PR, that test finds 8 unannotated errors. I did not pin `ps(1)` with an `operator()` in `extension Ptr<S>`. It reports "no call operation found for type 'Ptr<S>'" even though `Ptr<S>` declares one. That is the out-of-scope gap you disclosed, and a test would make the misleading message official. The `->` row pins only the prefix "'tag' is not a member of", because the full message names the opened type as `arrowOnInterfacePointer..This`.

**N2 (A clarity 1, C C002): state why the two decisions agree.** The early return in `maybeInsertImplicitOpForMemberBase` hands `checkGeneralMemberLookupExpr` an unopened `IFoo`. That is correct only if the lookup there also comes back empty. It does. Slang does not allow extending an interface directly (E30852: "cannot extend interface type 'IFoo'"). So the unopened lookup sees only the interface's requirements, and the opened value has those too. I checked this on d7b13fd. Suggested wording: "We only skip opening when the opened value has no member of that name. Interfaces cannot be extended directly, so the lookup on the unopened interface in `checkGeneralMemberLookupExpr` finds nothing either and falls back to the same pointer level."

**N3 (A clarity 8, C C003): the stand-in `VarDecl`.** Say that the stand-in only gives this one lookup the shape of the opened value, and that neither it nor the type built from it is used afterwards. Also say why a lookup on the interface type itself is not enough: it misses members of `extension<T : IFoo> T`, and the `pFoo.extra()` row in `ptr-extension-interface-pointee.slang` pins that.

**N4 (A clarity 4, C FG003): `outermostLevel`** holds the first level that is searched, not the outermost one. Rename it to something like `firstSearchedLevel`.

**N5 (A clarity 6, C FG007): `visitStaticMemberExpr`.** The new sentence was attached to the old "Not sure this is needed -> but guess someone could do" fragment. Give it its own comment line.

**Optional (A and C wording):**
- Define "pointer level" once, in the `findPtrLevelWithMember` doc, and use the term only there.
- Mention the interface precondition in the name or doc of `isMemberOnlyOnDerefedPtrTypes` (FG001).
- The subscript call-site comment (FG008): a subscript base never dereferences a `Ptr`, so say "only non-`Ptr` levels can be recorded here".
- C also suggests a sentence in the user guide's pointer section. That is not required for this fix.

### Disagreements

- None between A and C. Both are clarity-level apart from A's two test gaps.
- B (Devin) reports 0 findings again. Its commit status is `unknown`, so I can't tell whether it reviewed d7b13fd.
- The fixer did not use default parameters. I agree, and nothing in A or C objects.

### Maintainer direction (re-checked live; no new human comments on #14295 or #14317)

| # | Requirement | Status | Evidence at d7b13fd |
|---|---|---|---|
| M1 | `DescriptorHandle<T>` member calls go to `T` (kaizhangNV, [#10962](https://github.com/shader-slang/slang/issues/10962#issuecomment-4329895229)) | **met** | `findPtrLevelWithMember` searches only `PtrType` levels; `pointer-extension-member-not-found.slang` checks `t.h()` and `pt.h()` |
| I1–I3 | Issue requirements: the 5 forms work, the working forms still work, `ptr-extension-this-type.slang` is re-enabled | **met** | as in R1; all pass on d7b13fd |

The fixer's self-check (R1, R2, R3 met) agrees with mine. #14299 is still open at 5eb526851, so the manual `DISABLE_TEST` deletion still applies to whichever PR lands second.

## Reviewer A — Correctness (nv-slang-bot)

I've verified all findings against the source. The final review follows.

**Verdict**: 🔴 Has issues — 0 bugs, 2 gaps (plus 8 clarity comments)

This PR makes `p.m` look `m` up on the `Ptr` levels the base was implicitly dereferenced through, once lookup on the fully dereferenced base finds nothing. It replaces `bool needDeref` with a `derefBases` list, adds `findPtrLevelWithMember`, and adds `isMemberOnlyOnDerefedPtrTypes` so that an `IFoo*` base is not opened when the member is only on the pointer level. No crash, UB, or miscompile was found. The gaps are untested interactions:
- Mutation and visibility through the rebound base.
- `.` reaching pointer-extension members while `::` and `operator()` do not.

The clarity comments are about:
- The "member only on a pointer level" decision being made in two places.
- Inconsistent "pointer level" terminology.
- Helper names that don't match their contracts.
- The unexplained `->` rule.

<details>
<summary>Changes Overview</summary>

**Pointer-level member lookup** (`source/slang/slang-check-expr.cpp`, `source/slang/slang-check-impl.h`)
- What changed: `maybeDereference` now records each expression it dereferences, outermost first. `checkGeneralMemberLookupExpr` falls back to `findPtrLevelWithMember` when the pointee has no such member. That helper searches `PtrType` levels innermost first with `LookupOptions::NoDeref`, then sets `expr->baseExpression` to the matching level. `->` skips the outermost `Ptr` level and any non-`Ptr` levels outside it.
- `DescriptorHandle`, `ConstantBuffer` and `Ref` levels are never searched.

**Existential pointee handling** (`source/slang/slang-check-expr.cpp`)
- What changed: `maybeInsertImplicitOpForMemberBase` now takes the `MemberExpr`. It skips `openExistential` when a stand-in `ExtractExistentialType` lookup misses the member but a `Ptr` level has it, so `nextEntry().tag()` evaluates `nextEntry()` once.

**Signature threading** (`visitIndexExpr`, `visitInvokeExpr` `operator()` path, `visitStaticMemberExpr`, `checkTupleSwizzleExpr`)
- What changed: these callers now pass a `derefBases` list. Only `visitMemberExpr` and the tuple-swizzle fallbacks read it.

**Tests** (`tests/language-feature/extensions/ptr-extension-instance-member.slang`, `tests/language-feature/extensions/ptr-extension-interface-pointee.slang`, `tests/diagnostics/pointer-extension-member-not-found.slang`, `tests/bugs/ptr-extension-this-type.slang`)
- What changed: new runtime tests on cpu/vk/cuda cover one-, two- and three-level lookup, pointee-wins shadowing, `[mutating]` on l-value bases, tuple fallback, and single evaluation of `IFoo*`. A new diagnostic test pins the `->`, `ConstantBuffer` and `DescriptorHandle` exclusions.
- `ptr-extension-this-type.slang` changes `CHECK: 1` to `CHECK: result=1`. The old check could match `result code = 1` from a failed compile.

</details>

<details>
<summary>Findings (10 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🟡 Gap | `source/slang/slang-check-expr.cpp:9513` | Mutation, setter, visibility and `->`-on-`IFoo*` behavior through the rebound base is untested |
| 🟡 Gap | `source/slang/slang-check-expr.cpp:5371` | `p.s()` now reaches static pointer-extension members, but `p::s()` and `p(...)` don't; neither is tested |
| Clarity | `source/slang/slang-check-expr.cpp:9389` | The "only on a pointer level" decision is made twice, against two different types, and the invariant that they agree is not stated |
| Clarity | `source/slang/slang-check-impl.h:4250` | "Pointer level" is used for both every `derefBases` entry and only `PtrType` entries |
| Clarity | `source/slang/slang-check-expr.cpp:9404` | `isMemberOnlyOnDerefedPtrTypes` and `findPtrLevelWithMember` names don't match what they return |
| Clarity | `source/slang/slang-check-expr.cpp:9465` | `->` rule for non-`Ptr` levels outside the first `Ptr` is not justified; `outermostLevel` has two meanings |
| Clarity | `source/slang/slang-check-expr.cpp:3618` | Three call sites build an out-parameter only to explain why it is unused |
| Clarity | `source/slang/slang-check-expr.cpp:9110` | New comment splits the existing sentence fragment from its statement |
| Clarity | `source/slang/slang-check-impl.h:4311` | `outDerefBases` / `memberExpr` contracts are stated inconsistently across the three docs |
| Clarity | `source/slang/slang-check-expr.cpp:9424` | The stand-in `VarDecl` is not described as a cache key only |

</details>

<sub>reviewed: d7b13fda70f62913cede50ef69157047e9437c24 · diff sha256 487dd36afafe</sub>

---

### `source/slang/slang-check-expr.cpp:9513`

🟡 **Gap**: Mutation, setter, visibility and `->`-on-`IFoo*` behavior through the rebound base is untested

When the pointee lookup fails, `expr->baseExpression = ptrBase;` replaces the base. After that, the replaced base is what decides several checks:
- The l-value check for `[mutating]` members and setters is done against the replaced base. That check is `if (context.baseExpr && !context.baseExpr->type.isLeftValue)` in `slang-check-overload.cpp:1093`.
- The visibility filter now sees members found on the pointer level.

What the new tests cover, and what they don't:
- `[mutating]` members are only called on l-value bases (`cursor.advance()`, `pp.advance()`).
- The only property, `plusTen`, has a getter and no setter.
- The rule in the new comment, "a member of that name on the fully dereferenced base hides the pointer levels, whether or not it is visible", has no test.
- `->` on an interface pointer goes through both the new early return in `maybeInsertImplicitOpForMemberBase` and the `->` skip. Only the positive case `pFoo->getVal()` is covered, by an existing test.

**Example**: each of these lines used to fail with E30027. Each now depends on the new code and is not pinned by any test:
```slang
interface IFoo { int getVal(); }
extension Ptr<int> { [mutating] void advance() { this = this + 1; } }
extension<T> Ptr<T> { int tag() { return 10; } }
struct S { private int m() { return 0; } }
extension Ptr<S> { int m() { return 1; } }

void f(Ptr<int> p, Ptr<S> ps, ConstantBuffer<Ptr<int>> cb, IFoo* pf)
{
    (p + 1).advance(); // base is an rvalue: expect E30050, not a lost write
    cb.advance();      // `*cb` is not an l-value (isImmutableBufferType): expect E30050
    ps.m();            // private pointee member hides Ptr<S>.m: expect E30600
    pf->tag();         // `->` skips Ptr<IFoo>: expect "not a member"; `pf.tag()` is fine
}
```

**Suggestion**: add these cases to `tests/diagnostics/pointer-extension-member-not-found.slang`, or to a sibling diagnostic test. Also add a property with a `[nonmutating] set` to `ptr-extension-instance-member.slang`, for example `pp.value = 33;` checked against the buffer, so the write-through setter path runs.

---

### `source/slang/slang-check-expr.cpp:5371`

🟡 **Gap**: `p.s()` now reaches static pointer-extension members, but `p::s()` and `p(...)` don't; neither is tested

Static members now behave differently depending on the syntax:
- `p.s()` works. The fallback finds `s` on `Ptr<int>`, and `createLookupResultExpr` takes its `isEffectivelyStatic` branch.
- `p::s()` fails. `visitStaticMemberExpr` dereferences to `*p : int` and calls `_lookupStaticMember` on `int`, which reports E30027. The new comment at 9110 says this is intended: "A static member is looked up only in the dereferenced type".

`operator()` has the same split. `p(1)` with an `operator()` declared in `extension Ptr<S>` looks only in `S`. It then reports `CallOperatorNotFound{.type = baseType}` with `baseType = Ptr<S>`, a type that does declare the operator.

The new `.` behavior for static members has no test. The deliberate exclusions for `::` and `()` have no test either.

**Example**:
```slang
extension Ptr<int> { static int s() { return 1; } }
struct S { int v; }
extension Ptr<S> { int operator()(int x) { return x; } }

int f(Ptr<int> p, Ptr<S> ps)
{
    return p.s()      // compiles after this PR
         + p::s()     // still E30027: 's' is not a member of 'int'
         + ps(1);     // still CallOperatorNotFound naming Ptr<S>
}
```

**Suggestion**: add a runtime check for `p.s()`. For `::` and `operator()`, either give them the same `derefBases` fallback, or pin the exclusion with a negative diagnostic test so the `.`-only surface is a recorded decision.

---

### `source/slang/slang-check-expr.cpp:9389`

**Clarity**: The "member is only on a pointer level" decision is made twice, against two different types

For an `IFoo* p` base, the check "is `m` missing on the pointee but present on a `Ptr` level" runs twice:
1. `isMemberOnlyOnDerefedPtrTypes` looks `m` up on a stand-in `ExtractExistentialType`. It then calls `findPtrLevelWithMember` and discards the `LookupResult ptrResult` that the call fills in.
2. `checkGeneralMemberLookupExpr` looks `m` up on the unopened `IFoo` and calls `findPtrLevelWithMember` again.

The early `return baseExpr` passes an unopened existential to `visitMemberExpr`. That is safe only if step 2 is guaranteed to replace the base with the pointer level. The comment also says opening would "evaluate `p` twice". That outcome depends on the later replacement in `checkGeneralMemberLookupExpr`, not on anything in this function.

Neither comment says the two checks must agree, or why they always do. Could the comment state this invariant and why it holds? Alternatively, passing the chosen level and its `LookupResult` forward to `checkGeneralMemberLookupExpr` would make one place responsible for the decision.

---

### `source/slang/slang-check-impl.h:4250`

**Clarity**: "Pointer level" is used for both every `derefBases` entry and only `PtrType` entries

The PR uses several names for one concept: "deref bases", "pointer levels", "ptr level", "the pointer types that the base was dereferenced through", and "derefed ptr types".

`derefBases` also holds `ConstantBuffer<T>`, `DescriptorHandle<T>` and `Ref<T>` levels, and those are never searched. The comments disagree about what "pointer level" means:
- Here and on `isMemberOnlyOnDerefedPtrTypes`, every entry is a "pointer level" ("the member may be found on one of those pointer levels").
- `findPtrLevelWithMember` uses the term only for `PtrType` entries.

Could the PR define the term once, for example in the `maybeDereference` doc, and use it consistently? A reader should not need to read the body of `findPtrLevelWithMember` to learn that a `ConstantBuffer` entry is a level but not a searched one.

---

### `source/slang/slang-check-expr.cpp:9404`

**Clarity**: The names of the two new lookup helpers don't match their contracts

```cpp
    auto interfaceType = unwrapModifiedType(baseExpr->type.type);
    auto declRefType = as<DeclRefType>(interfaceType);
    if (!declRefType)
        return false;
```

`isMemberOnlyOnDerefedPtrTypes` returns `false` for every base that is not an interface, even when the member is only on a `Ptr` level. For `Ptr<int> p; p.loadPlusOne()`, it returns `false`. So the function really answers "should the existential stay closed?", and a caller who trusts the name would get the wrong answer.

Similarly, `findPtrLevelWithMember` returns the base expression at a level, not a level, and its caller assigns the result straight to `expr->baseExpression`.

Could the names, or the first sentence of each doc comment, say what each function actually computes?

---

### `source/slang/slang-check-expr.cpp:9465`

**Clarity**: The `->` rule for non-`Ptr` levels outside the first `Ptr` is not justified, and `outermostLevel` has two meanings

```cpp
    // `p->m` names a member of `*p`, so `->` consumes the outermost `Ptr` level, together with
    // any non-`Ptr` levels outside it (as in `ConstantBuffer<Ptr<int>>`), and those levels do
    // not contribute members.
    Index outermostLevel = 0;
```

"`p->m` names a member of `*p`" explains why the first `Ptr` level is skipped. It does not explain why a `ConstantBuffer` level outside that `Ptr` is skipped too. In the base compiler, `cb->x` on a `ConstantBuffer<S>` already means `(*cb).x`, so `->` consumes the `ConstantBuffer` level itself. By that reading, `cbPtr->g()` on a `ConstantBuffer<Ptr<int>>` would mean `(*cbPtr).g()` and would find `g` on `Ptr<int>`. The new diagnostic test pins it as an error instead.

Which model of `->` is intended: "dereference one implicit-deref level", or "dereference through the first `Ptr`"? Could the comment state the chosen model and the reason for it?

There is also a naming problem. The comment uses "the outermost `Ptr` level" for the level that is skipped. The variable `outermostLevel` ends up one past that level, at the outermost level that *is* searched. With no `PtrType` level at all, it ends at `count + 1`. A name such as `firstSearchedLevel` would save the reader from stepping through the `while`/`++` pair.

---

### `source/slang/slang-check-expr.cpp:3618`

**Clarity**: Three call sites build an out-parameter only to explain why it is unused

```cpp
        // A subscript does not look in the pointer types that its base is dereferenced
        // through, so `derefBases` is unused here.
        baseExpr = checkBaseForMemberExpr(
            subscriptExpr->baseExpression,
            CheckBaseContext::Subscript,
            derefBases,
            nullptr);
```

Three of the five callers declare a `List<Expr*>`, add a comment explaining it is unused, and pass `nullptr` for `memberExpr`:
- `visitIndexExpr` (here)
- the `operator()` path in `visitInvokeExpr`
- `visitStaticMemberExpr`

When most callers have to explain why they ignore an out-parameter, the parameter is probably in the wrong place. If the parameters were optional (`List<Expr*>* outDerefBases = nullptr`, `MemberExpr* memberExpr = nullptr`), these call sites would need neither the extra list nor the comments.

---

### `source/slang/slang-check-expr.cpp:9110`

**Clarity**: The new comment splits the existing sentence fragment from its statement

```cpp
    // Not sure this is needed -> but guess someone could do
    // A static member is looked up only in the dereferenced type, so `derefBases` is unused.
    List<Expr*> derefBases;
```

The existing fragment "Not sure this is needed -> but guess someone could do" refers to the `maybeDereference` call. The new sentence now sits between the fragment and that call, so the comment reads as "…someone could do A static member is looked up only…". Could the new sentence move below the old one? Better still, the old fragment could become a full sentence that says why `p::m` dereferences at all.

---

### `source/slang/slang-check-impl.h:4311`

**Clarity**: The `outDerefBases` / `memberExpr` contracts are stated inconsistently across the three docs

```cpp
    /// The expressions that the base is implicitly dereferenced through are appended to
    /// `outDerefBases` (see `maybeDereference`), and `memberExpr` is passed to
    /// `maybeInsertImplicitOpForMemberBase`.
```

The three doc comments disagree about the contract:
- `maybeDereference` asserts `outDerefBases.getCount() == 0` on entry.
- All three docs still say the expressions are "appended", which suggests a list that already has entries is allowed.
- Only the `maybeDereference` doc mentions the empty-on-entry precondition, but callers reach it through `checkBaseForMemberExpr`.

Separately, "`memberExpr` is passed to `maybeInsertImplicitOpForMemberBase`" describes the body, not the contract. The doc does not say that null is allowed, or that passing null means the existential is always opened.

Could the three docs describe both parameters the same way, from the caller's point of view?

---

### `source/slang/slang-check-expr.cpp:9424`

**Clarity**: The stand-in `VarDecl` is not described as only a cache key, and its type differs from the opened type's

```cpp
    VarDecl* standInDecl = m_astBuilder->create<VarDecl>();
    standInDecl->type.type = baseExpr->type.type;
    auto openedType = m_astBuilder->getOrCreate<ExtractExistentialType>(
        makeDeclRef(standInDecl),
        interfaceType,
        interfaceDeclRef);
```

The comment explains why lookup runs on an opened type. It does not say what the stand-in is. From the code:
- The decl is unnamed, has no parent, is never checked, and is never added to a scope.
- It is reachable only through an `ExtractExistentialType` whose lookup result is discarded.
- `getOrCreate` keys on the decl, so every call interns a new type and witness.
- The decl's type is `baseExpr->type.type`, which may be a `ModifiedType`, while the opened type uses the unwrapped `interfaceType`. That matches `openExistential`/`moveTemp`, but the code doesn't say so.

Could the comment say that the decl exists only to give the opened type an identity, and that nothing built from it escapes? Alternatively, sharing the `ExtractExistentialType` construction with `openExistential` would make the claim "found exactly as they would be after `openExistential`" true by construction.

## Reviewer B — Devin Review

# Devin Review

## AI Analysis

Member lookup on a pointer value now falls back to extension members of the pointer types it was dereferenced through. Pointee members still win, so only code that previously failed with E30027 changes.

Records every implicitly dereferenced pointer expression in a list instead of a single needDeref flag.
Searches that list innermost first for an extension member when the dereferenced base has none.
Leaves p->m lookup unchanged by skipping the pointer that the arrow dereferences.
Show less

Summary: p.g() failed with E30027 when g comes from extension Ptr<int> (or int*, Ptr<S>, extension<T> Ptr<T>). When the pointee has no such member, lookup now also searches each Ptr level that the base was dereferenced through, innermost first.

Root cause: maybeDereference (slang-check-expr.cpp:8423) turns p into *p before lookup, so member lookup only searched the pointee type.

Tests: new ptr-extension-instance-member.slang, ptr-extension-interface-pointee.slang (cpu/vk/cuda) and pointer-extension-member-not-found.slang; ptr-extension-this-type.slang CHECK made strict.

Risk: front-end. Pointee members still win; interface pointers evaluate once. -> consumes the outermost Ptr level (with a ConstantBuffer outside it): pp->g() now works, p->g() still fails. DescriptorHandle<T> (#10962) is unchanged.

Fixes #14295

🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.

Show less

Loading diffs…

This may take a few moments for large PRs

Info
Chat

## Vulnerabilities

(none reported)

## Bugs

(none reported)

## Flags

(none reported)

## Informational

(none reported)

## Reviewer C — Clarity

# PR 14317 Clarity Review (Canonical)

PR: shader-slang/slang#14317 "Find extension members of a pointer type through a pointer value"
Head: d7b13fda70f62913cede50ef69157047e9437c24
Raw inputs: `tmp/review-candidates/pr-14317-clarity.md`, `tmp/review-candidates/pr-14317-fine-grained-clarity.md`

## PR Summary

**What the description says.** Calling `p.g()` failed with E30027 when `g` comes from `extension Ptr<int>`, `int*`, `Ptr<S>` or `extension<T> Ptr<T>`. The cause given is that `maybeDereference` rewrites `p` to `*p` before lookup. With the fix, when the pointee has no such member, lookup also searches each `Ptr` level the base was dereferenced through, innermost first. Pointee members still win, interface pointers are evaluated once, `->` consumes the outermost `Ptr` level, and `DescriptorHandle<T>` is unchanged. Fixes #14295.

**What the diff does.** The diff matches the description. It:

- Changes `maybeDereference` to record its dereference chain (`List<Expr*> derefBases`, outermost first), replacing the old `bool needDeref`.
- Threads that list through `checkBaseForMemberExpr` and `maybeInsertImplicitOpForMemberBase` to `checkGeneralMemberLookupExpr`. The latter calls a new `findPtrLevelWithMember` helper when lookup on the dereferenced base fails, and on a hit rewrites `expr->baseExpression` to that level's expression.
- Adds `isMemberOnlyOnDerefedPtrTypes` for interface pointees, so that `maybeInsertImplicitOpForMemberBase` skips `openExistential` when the member exists only on a pointer level. That decision builds a stand-in `VarDecl` and an `ExtractExistentialType` purely to drive a lookup.
- Adds three tests, run on CPU, Vulkan and CUDA plus one diagnostic test, and tightens a pre-existing INTERPRET test whose bare `CHECK: 1` could pass on error output.

**Mismatches and notes.**

- The description doesn't mention a language-visible change: `pp->g()` on a `Ptr<Ptr<int>>` now resolves.
- The description doesn't use the repository's required five-part PR format (Motivation / Proposed solution / Change summary / Concepts / Process report). In particular, there is no process report justifying the stand-in `VarDecl` input shape, which CLAUDE.md flags as a review red flag.

**Value.** This is a real usability fix with well-chosen positive and negative tests. The main risk is how understandable the new lookup rule is, not its basic correctness.

## Review Body

> Claude Opus 5.5 authored clarity review:
>
> This is a focused front-end fix, about 130 lines of logic in `slang-check-expr.cpp` plus header docs, with a solid set of tests. The tests cover multi-level pointers, `->`, `ConstantBuffer<Ptr<T>>`, `DescriptorHandle<T>` exclusion, shadowing by pointee members, mutating members, and single evaluation of an interface-pointer base. That breadth is a strong point. The approach — recording the implicit dereference chain instead of discarding it — keeps the provenance that the old `bool needDeref` threw away, and that seems like the right layer.
>
> The PR is functionally close to merge-ready. What holds it back is clarity: the new lookup rule is subtle, and it is currently hard to see it whole or to trust it from reading the code.
>
> ## Main concerns
>
> - **The rule set lives in pieces.** Pointee-hides-pointer, innermost-first, `PtrType`-only, `->` skipping consumed levels, and leaving interface pointees unopened are each stated in a different comment, in a different function. One authoritative statement, which the other comments point back to, would make the design reviewable.
> - **Interface pointees are decided twice.** `isMemberOnlyOnDerefedPtrTypes`, called during base preparation, and the fallback in `checkGeneralMemberLookupExpr` each do their own lookups. The early return is correct only if the two always agree, and nothing states why they do.
> - **A stand-in `VarDecl`.** A fabricated, unparented `VarDecl` keys an `ExtractExistentialType` for that check. Please say why that is valid input for `ExtractExistentialType`/lookup, that the result never escapes, and why lookup on the interface type itself isn't enough.
> - **Terminology and naming.** "Pointer level" is never defined and shifts between expression, type and dereference step. The name `isMemberOnlyOnDerefedPtrTypes` doesn't match its interface-only behaviour. `outermostLevel` holds the first *searched* level.
>
> ## Smaller items
>
> The remaining inline comments are local. They cover `lookupResult`/`baseType` meaning different things after the fallback, a new comment merged into an unrelated pre-existing one, a subscript call-site comment describing a case that can't occur, "appended" vs. "must be empty", and some test cases that don't say what they cover.
>
> One non-blocking suggestion: `.` on a pointer now reaches pointer-extension members, and `->` on a multi-level pointer now resolves. Both are user-visible, so a sentence in the user guide's "Pointers" section, plus a PR description that follows the repository's five-part format with a process report for the stand-in-decl choice, would help reviewers and users confirm that the behaviour is intended.

## Kept

### C001: The new member-lookup rule set has no single authoritative statement

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-impl.h:4259-4283`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: FG002 (undefined term) and C002 (two decision points) are related but ask for different, local fixes; this one asks for the single overall statement of the rule.
- Scope decision: Direct
- Scope rationale: The rule and all the comments that partially describe it are introduced by this PR.

Context:

```cpp
/// Find the pointer level of a member expression's base that has the member named by
/// `expr`. `derefBases` holds the expressions that the base was implicitly dereferenced
/// through, outermost first. Return the base at the innermost `PtrType` level whose type
/// has the member, ...
Expr* findPtrLevelWithMember(
```

```cpp
// A member that only a pointer level has is called on that level, so we leave the
// existential closed: opening it would bind `*p` to a temporary and evaluate `p` twice.
if (memberExpr && isMemberOnlyOnDerefedPtrTypes(memberExpr, baseExpr, outDerefBases))
    return baseExpr;
```

```cpp
// A member of that name on the fully dereferenced base hides the pointer levels,
// whether or not it is visible and whatever its signature. ...
if (auto ptrBase = findPtrLevelWithMember(expr, derefBases, lookupResult))
    expr->baseExpression = ptrBase;
```

Proposed comment:

> This PR adds a new member-lookup rule, but the rule is split across about seven comments in two files, and none of them states the whole thing. A reader has to put together, from separate places: (1) a member of the fully dereferenced base hides every pointer level, even when it isn't visible or has the wrong signature; (2) pointer levels are searched innermost first; (3) only `PtrType` levels are searched, not `DescriptorHandle`, `ConstantBuffer` or `Ref`; (4) `->` skips the levels it consumes; (5) for an interface pointee, the existential is left closed when the member exists only on a pointer level. Each piece is enforced in a different function (`maybeDereference`, `maybeInsertImplicitOpForMemberBase`/`isMemberOnlyOnDerefedPtrTypes`, `findPtrLevelWithMember`, `checkGeneralMemberLookupExpr`).
>
> Could the rule be written down once, in one place, with each function's comment pointing back to it? Then a reader can check each piece against the whole, and a later change to one piece (say, letting `Ref<T>` levels contribute) will visibly need matching changes elsewhere.

Notes:
Raised because the PR introduces a language-visible lookup rule with five interacting sub-rules, and the per-function comments each restate a fragment.

### C002: Two separate decision points must agree on "member is only on a pointer level", but the argument is not stated

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-expr.cpp:9387-9390`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: Distinct from FG001 (naming/contract of the predicate) and C003 (validity of the stand-in decl); this one is about agreement between the two lookup sites.
- Scope decision: Direct
- Scope rationale: The early return, the new predicate, and the new fallback are all added by this PR.

Context:

```cpp
// A member that only a pointer level has is called on that level, so we leave the
// existential closed: opening it would bind `*p` to a temporary and evaluate `p` twice.
if (memberExpr && isMemberOnlyOnDerefedPtrTypes(memberExpr, baseExpr, outDerefBases))
    return baseExpr;
```

```cpp
bool SemanticsVisitor::isMemberOnlyOnDerefedPtrTypes(...)
{
    ...
    LookupResult ptrResult;
    if (!findPtrLevelWithMember(memberExpr, derefBases, ptrResult))
        return false;
    ...
    LookupResult pointeeResult =
        lookUpMember(m_astBuilder, this, memberExpr->name, openedType, m_outerScope);
    return !pointeeResult.isValid();
}
```

```cpp
LookupResult lookupResult =
    lookUpMember(m_astBuilder, this, expr->name, baseType, m_outerScope);
if (!lookupResult.isValid())
{
    ...
    if (auto ptrBase = findPtrLevelWithMember(expr, derefBases, lookupResult))
        expr->baseExpression = ptrBase;
}
```

Proposed comment:

> For an interface pointee, "is this member found only on a pointer level?" is now decided twice. First `isMemberOnlyOnDerefedPtrTypes` decides it, inside base preparation, by looking the member up on a stand-in opened type and then on the pointer levels; it throws away the pointer-level result (`ptrResult`). Later, `checkGeneralMemberLookupExpr` decides it again, independently, by looking up on the *unopened* interface type and then repeating the same pointer-level search.
>
> The early return is only correct if the second check comes out the same way as the first. In particular, a lookup on the bare interface type must find nothing whenever the lookup on the opened type found nothing. Otherwise the member would resolve against an existential that was never opened. Nothing says this holds, or why. Could you either state that invariant and why it holds, or restructure so the decision is made once and carried forward (for example, by passing the chosen level or its lookup result along)? It would also help to say in the `maybeInsertImplicitOpForMemberBase` contract that "preparing the base" now includes member lookup when `memberExpr` is non-null.

Notes:
The duplicated `findPtrLevelWithMember` call and the discarded `ptrResult` out-param are the visible symptom. The invariant plausibly holds (lookup on an opened type reaches the interface's members through its this-type decl-ref), but the reader has to work that out for themselves.

### C003: A fabricated `VarDecl` is used to key an `ExtractExistentialType` without a stated validity argument

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: decl-ref/substitution
- Location: `source/slang/slang-check-expr.cpp:9421-9432`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: C002 is about agreement between two lookups; this one is about whether the stand-in construction itself is valid input.
- Scope decision: Direct
- Scope rationale: The stand-in decl and opened type are new code in this PR.

Context:

```cpp
// We look the member up on a stand-in for the opened value, so that members that apply
// to every conforming type, such as those of `extension<T : IFoo> T`, are found exactly
// as they would be after `openExistential`.
VarDecl* standInDecl = m_astBuilder->create<VarDecl>();
standInDecl->type.type = baseExpr->type.type;
auto openedType = m_astBuilder->getOrCreate<ExtractExistentialType>(
    makeDeclRef(standInDecl),
    interfaceType,
    interfaceDeclRef);
LookupResult pointeeResult =
    lookUpMember(m_astBuilder, this, memberExpr->name, openedType, m_outerScope);
```

Proposed comment:

> The comment explains *why* we want an opened type here. It doesn't explain why it's valid to build one from a `VarDecl` that has no name, no parent, and no check state, and that no expression ever binds. Lookup on an `ExtractExistentialType` goes through `getThisTypeDeclRef()` and `getSubtypeWitness()`, and those cache witnesses built from this decl-ref onto the type node. A reader needs to know that none of these consumers need a real binding, and that `openedType` and anything derived from it (the cached this-type decl-ref, the witness, `pointeeResult`) never reach the checked AST. Without that, this looks like a parallel construction of `openExistential` that could drift from the real one.
>
> Please also say why lookup on `interfaceType` directly isn't enough. Is it specifically that `extension<T : IFoo> T` members are found only through an opened type? Then a reader can tell that the stand-in is needed, and not just convenient.

Notes:
CLAUDE.md lists fabricated/parallel representations as review red flags requiring justification in the process report.

### C004: The pointer-level search re-implements `lookUpMember`'s deref fallback with different rules; the relationship and the `PtrType`-only filter are explained only in compressed form

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: organization
- Location: `source/slang/slang-check-impl.h:4275-4279`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: Absorbs FG005 (doc comment carrying implementation rationale) and FG006 (vague "stand in for `T`" / "by design" in the loop) because all three concern the justification for the `PtrType`-only search.
- Scope decision: Direct
- Scope rationale: The comparison to `lookUpMember` and the `PtrType`-only filter are both introduced by this PR.

Context:

```cpp
/// `lookUpMember` has its own pointee-then-pointer fallback, but it does not apply here.
/// A member-expr base is already fully dereferenced, because swizzles and existential
/// opening need that form, and the fallback looks through every pointer-like type, which
/// would expose members of `DescriptorHandle<T>`. Each level is therefore looked up with
/// `LookupOptions::NoDeref`.
```

```cpp
// We search innermost first, which is the order of the deref fallback in `lookUpMember`.
for (Index level = derefBases.getCount() - 1; level >= outermostLevel; level--)
{
    // Only `PtrType` levels are searched. A `DescriptorHandle<T>` always forwards member
    // calls to `T` by design, and `ConstantBuffer<T>` and `Ref<T>` stand in for `T`.
```

Proposed comment:

> The codebase now has two implementations of "try the pointee, then the pointer": the `Deref` fallback in `_lookUpMembersInSuperTypeImpl`, and the loop in `findPtrLevelWithMember`. They share an order (innermost first) but disagree on which levels count: all pointer-like types there, only `PtrType` here. This comment packs two separate arguments into one sentence. One is "the fallback never fires, because the base is already dereferenced". The other is "even if it did fire, it would expose `DescriptorHandle<T>` members". Which is the reason the PR can't reuse it? The loop's justification doesn't settle it either. What does "`ConstantBuffer<T>` and `Ref<T>` stand in for `T`" mean concretely: that extensions on those types are deliberately unreachable through `.`? And "by design" for `DescriptorHandle<T>` points to a decision (#10962) that the code doesn't cite.
>
> Could you say which constraint is the operative one, state the `PtrType`-only rule concretely (with a link to the design decision), and say whether the two fallbacks are meant to stay in sync? Since this is implementation rationale, it might fit better as an implementation comment next to the `LookupOptions::NoDeref` call than in the declaration's doc comment.

Notes:
Framed as a clarity request rather than a demand to unify the two fallbacks.

### C006: The "pointee member hides pointer levels regardless of visibility or signature" rule is stated without rationale

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-expr.cpp:9509-9511`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: C001 lists this as one sub-rule; this candidate asks specifically for its rationale, and FG004 (adjacent lines) concerns variable reuse, not policy.
- Scope decision: Direct
- Scope rationale: The policy and its comment are new in this PR.

Context:

```cpp
if (!lookupResult.isValid())
{
    // A member of that name on the fully dereferenced base hides the pointer levels,
    // whether or not it is visible and whatever its signature. We look in the pointer
    // levels only when lookup on the base finds nothing at all.
```

Proposed comment:

> This states a policy with a visible consequence. If `Shadow` has a private `get()`, or a `get()` with a different signature, then `extension Ptr<Shadow> { int get(int); }` can never be called as `pShadow.get(1)`. The comment says what happens but not why hiding was chosen over, say, merging the candidates into one overload set. Is it to match `lookUpMember`'s own "first valid result wins" fallback, which returns before any visibility filtering? A one-line reason would let a reader confirm the behaviour is intended and not an accident of where the fallback was inserted.

Notes:
Only the same-signature shadowing case (`pShadow.get()`) is tested; neither the visibility case nor the different-signature case is.

### FG001: `isMemberOnlyOnDerefedPtrTypes` — name, doc, and body disagree about the interface precondition

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-impl.h:4285-4292`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: C002 concerns how this predicate interacts with the later lookup; this candidate concerns the predicate's own name/contract consistency.
- Scope decision: Direct
- Scope rationale: New declaration added by this PR.

Context:

```cpp
/// Return whether the member named by `memberExpr` is missing from the opened value of the
/// interface-typed `baseExpr` but found on one of the pointer levels in `derefBases`.
/// Consider `IFoo* p` with `extension<T> Ptr<T> { int tag() }`: `p.tag()` is called on `p`,
/// so its base must not open the existential `*p`.
bool isMemberOnlyOnDerefedPtrTypes(
    MemberExpr* memberExpr,
    Expr* baseExpr,
    List<Expr*> const& derefBases);
```

```cpp
auto interfaceType = unwrapModifiedType(baseExpr->type.type);
auto declRefType = as<DeclRefType>(interfaceType);
if (!declRefType)
    return false;
auto interfaceDeclRef = declRefType->getDeclRef().as<InterfaceDecl>();
if (!interfaceDeclRef)
    return false;
```

Proposed comment:

> Read the name, the doc comment, and the body together, and the contract becomes unclear. The name promises a general predicate: "is the member only on dereferenced pointer types?". The doc describes "the interface-typed `baseExpr`" as if callers must pass an interface. The body takes any base and quietly returns `false` for a non-interface one, even when the member really is only on a pointer level. So, for `Ptr<int> p; p.g()`, the answer is "no", although `g` exists only on `Ptr<int>`. Its one caller uses it to mean "should we skip opening the existential?".
>
> Could the name and the doc describe what the predicate actually decides, including what `false` means for a non-interface base? "Derefed" and "PtrTypes" also don't match the "pointer level" wording used everywhere else in this PR.

Notes:
Name/contract/body consistency check from the function checklist.

### FG002: "pointer level" is never defined and is used for an expression, a type, and a dereference step

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: terminology
- Location: `source/slang/slang-check-impl.h:4320-4326`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: Related to C001 but a separate local terminology fix; re-anchored on the `maybeDereference` doc so it doesn't share lines with C001.
- Scope decision: Direct
- Scope rationale: The term and all of its uses are introduced by this PR.

Context:

```cpp
/// Implicitly dereference `inExpr` through each type that
/// `getPointedToTypeIfCanImplicitDeref` sees through (...), and return the result. ...
/// Each expression that gets dereferenced is appended to `outDerefBases`, which
/// must be empty on entry, outermost first: for `pp : Ptr<Ptr<int>>`, the result is `**pp`
/// and `outDerefBases` receives `pp` and `*pp`.
Expr* maybeDereference(
```

```cpp
/// ... Return the base at the innermost `PtrType` level whose type has the member, ...
/// Levels that are not a `PtrType`, such as `DescriptorHandle<T>`, are not searched.
/// ... The innermost pointer level is `*pp : Ptr<int>`, which has `g`, ...
// `p->m` names a member of `*p`, so `->` consumes the outermost `Ptr` level, ...
// A member that only a pointer level has is called on that level, ...
```

Proposed comment:

> This is where `derefBases` is produced, so it would be a natural place to define the "pointer level" (or "level") that the rest of the PR relies on. As it is, the term is never defined and it shifts meaning. "The innermost pointer level is `*pp : Ptr<int>`" makes it an *expression*. "Levels that are not a `PtrType`" and "a member that only a pointer level has" make it a *type*. "`->` consumes the outermost `Ptr` level" makes it a *dereference step*. `findPtrLevelWithMember` returns an `Expr*`, not a level. And the list itself is described differently in five places ("expressions that the base was implicitly dereferenced through", "expressions that get implicitly dereferenced", and so on). Could the term be defined once and used consistently, so a reader knows exactly what an index into `derefBases` denotes?

Notes:
Revised from the raw candidate only to move the anchor and adjust the opening sentence.

### FG003: `outermostLevel` does not hold the outermost level

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: naming
- Location: `source/slang/slang-check-expr.cpp:9465-9475`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: No other candidate addresses this local variable or the no-`PtrType` `->` case.
- Scope decision: Direct
- Scope rationale: New code in a new function.

Context:

```cpp
Index outermostLevel = 0;
if (as<DerefMemberExpr>(expr))
{
    while (outermostLevel < derefBases.getCount() &&
           !as<PtrType>(derefBases[outermostLevel]->type))
        outermostLevel++;
    outermostLevel++;
}

// We search innermost first, which is the order of the deref fallback in `lookUpMember`.
for (Index level = derefBases.getCount() - 1; level >= outermostLevel; level--)
```

Proposed comment:

> The outermost level is always index 0. What this variable holds is the outermost level that is still *searched*. For `->`, that is one past the first `PtrType`, and when there's no `PtrType` at all (e.g. `cb->m` on a `ConstantBuffer<S>`), it is `getCount() + 1`. That last case makes the loop empty, which is correct, but you have to work through it to see that. A name that says "first level eligible for search", or a small helper that returns that bound, with the no-`PtrType` case spelled out, would make the `->` rule visible in the code and not just in the comment above it.

Notes:
Loop correctness is fine; the issue is that the name says something different from what the code computes.

### FG004: After the fallback, `lookupResult` and `baseType` describe different bases

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-expr.cpp:9512-9513`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: Adjacent to C006 but about variable reuse and the meaning of `baseType`, not the hiding policy; re-anchored on the call/rebase lines so the two don't share a range.
- Scope decision: Direct
- Scope rationale: The in-place reuse of `lookupResult` and the base rewrite are added by this PR.

Context:

```cpp
LookupResult lookupResult =
    lookUpMember(m_astBuilder, this, expr->name, baseType, m_outerScope);
if (!lookupResult.isValid())
{
    ...
    if (auto ptrBase = findPtrLevelWithMember(expr, derefBases, lookupResult))
        expr->baseExpression = ptrBase;
}
bool diagnosed = false;
lookupResult = filterLookupResultByVisibilityAndDiagnose(lookupResult, expr->loc, diagnosed);
...
if (!lookupResult.isValid())
{
    return lookupMemberResultFailure(expr, baseType, diagnosed);
}
```

Proposed comment:

> `lookupResult` is used both to hold the result of the failed pointee lookup and as the out-parameter for the pointer-level lookup. It is overwritten only on success. Once `expr->baseExpression` has been replaced, `baseType` is still the pointee type, so it no longer describes `expr->baseExpression`. All the code after this point (visibility and checked-optional filtering, the `lookupMemberResultFailure(expr, baseType, ...)` diagnostic, and the completion block that inspects `expr->baseExpression->type`) now runs against whichever of the two lookups succeeded, with a `baseType` that may or may not match. Could you make it explicit which base each of those steps is meant to see? For example, say that `baseType` deliberately stays the pointee type for diagnostics, or use a separate result variable so the two lookups can't be confused.

Notes:
I could not construct a case where the stale `baseType` yields a wrong diagnostic (filtering usually sets `diagnosed`), so this is framed as a readability/contract issue.

### FG007: New sentence appended to an unrelated, unfinished pre-existing comment in `visitStaticMemberExpr`

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-expr.cpp:9109-9113`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: FG008 covers the other two throwaway-list call sites; this one is specifically about the merged comment and the `::` policy.
- Scope decision: Direct
- Scope rationale: The appended comment line and the `::` exclusion it states are added by this PR; the request does not ask the author to fix the pre-existing line itself.

Context:

```cpp
// Not sure this is needed -> but guess someone could do
// A static member is looked up only in the dereferenced type, so `derefBases` is unused.
List<Expr*> derefBases;
expr->baseExpression =
    maybeDereference(expr->baseExpression, CheckBaseContext::Member, derefBases);
```

Proposed comment:

> The new line continues straight on from the existing unfinished sentence "Not sure this is needed -> but guess someone could do", so the two read as one muddled paragraph. The new sentence also states a policy: `::` doesn't consult pointer levels. Meanwhile `.` now does, and `checkGeneralMemberLookupExpr`'s fallback doesn't filter out static members, which suggests `p.staticFn()` and `p::staticFn()` may now resolve differently. Could the new comment be kept separate from the old one, and could it say whether excluding `::` is deliberate?

Notes:
Softened from the raw candidate: the `.` / `::` divergence is inferred from the fallback not filtering statics, not verified by a test.

### FG008: The subscript call-site comment describes a case that can't occur, and three call sites discard a mandatory out-list

- Status: Revise
- Confidence: Low
- Scope: Direct
- Category: API shape
- Location: `source/slang/slang-check-expr.cpp:3618-3624`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: FG007 covers the static-member call site's comment; this covers the subscript and call-operator sites and the shared API shape.
- Scope decision: Direct
- Scope rationale: The PR changed these signatures and wrote the new call-site comments.
- Judgment decision: Revise
- Judgment rationale: The mandatory-but-ignored out-parameter predates the PR (`bool& outNeedDeref`), so the API-shape part is now offered as optional. But the new subscript comment is inaccurate: `maybeDereference` returns before dereferencing any `PtrType` in a `Subscript` context. That inaccuracy is squarely the author's, so the comment now leads with it.

Context:

```cpp
// A subscript does not look in the pointer types that its base is dereferenced
// through, so `derefBases` is unused here.
baseExpr = checkBaseForMemberExpr(
    subscriptExpr->baseExpression,
    CheckBaseContext::Subscript,
    derefBases,
    nullptr);
```

```cpp
// `operator()` is looked up only in the dereferenced callee type, not in the
// pointer types that the callee is dereferenced through, so `derefBases` is unused.
List<Expr*> derefBases;
expr->functionExpr = maybeInsertImplicitOpForMemberBase(
    expr->functionExpr,
    CheckBaseContext::Member,
    derefBases,
    nullptr);
```

Proposed comment:

> This comment describes a case that can't happen. In a `Subscript` context, `maybeDereference` stops at the first `PtrType` without dereferencing it, so a subscript base is never "dereferenced through" a pointer type. The only levels this list can contain here are non-`Ptr` pointer-like types such as `ConstantBuffer<T>`, and `findPtrLevelWithMember` ignores those anyway. So the reason the list goes unused is different from the one stated.
>
> More broadly, only `visitMemberExpr` uses the dereference chain. The subscript, call-operator and static-member paths each declare a list, pass `nullptr`, and explain why they ignore it. If "not interested in the chain" were part of the API (an optional out-parameter, say), each call site could just say so, without a justification comment.

Notes:
The second paragraph is optional/advisory.

### FG009: `checkBaseForMemberExpr` / `maybeInsertImplicitOpForMemberBase` docs say "appended" while `maybeDereference` requires an empty list, and one doc describes forwarding rather than contract

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-impl.h:4311-4313`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: FG002 is about the undefined "level" term; this is about the empty-on-entry contract and a forwarding-style doc.
- Scope decision: Direct
- Scope rationale: Both doc comments are added by this PR.

Context:

```cpp
/// The expressions that the base is implicitly dereferenced through are appended to
/// `outDerefBases` (see `maybeDereference`), and `memberExpr` is passed to
/// `maybeInsertImplicitOpForMemberBase`.
Expr* checkBaseForMemberExpr(
```

```cpp
/// ... Each expression that gets dereferenced is appended to `outDerefBases`, which
/// must be empty on entry, outermost first: ...
Expr* maybeDereference(
```

Proposed comment:

> "Appended" suggests a caller can pass a list that already has entries. But `maybeDereference` asserts that `outDerefBases` is empty, and indices into the list are read as levels, outermost first. So this is really an output, not an accumulator. "`memberExpr` is passed to `maybeInsertImplicitOpForMemberBase`" describes the implementation, not what `memberExpr` means to a caller of `checkBaseForMemberExpr`. Could both docs state the contract directly: the list must start empty and receives the dereference chain, and `memberExpr` is the member being accessed, or null?

Notes:
Small, local doc-contract issue.

### FG010: `ptr-extension-instance-member.slang` cases don't say which lookup path they exercise

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/language-feature/extensions/ptr-extension-instance-member.slang:136-149`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: No other candidate covers per-case test intent in this file.
- Scope decision: Direct
- Scope rationale: New test file added by this PR.

Context:

```slang
Ptr<Tuple<int, int>> pTuple = tuplePtr;
// CHECK-NEXT: 4
outputBuffer[10] = pTuple.loadGeneric()._1;

// CHECK-NEXT: 1
outputBuffer[11] = pp.level();
// CHECK-NEXT: 130
outputBuffer[12] = pp.outerOnly();
// CHECK-NEXT: 30
outputBuffer[13] = pp.loadGeneric();
// CHECK-NEXT: 20
outputBuffer[14] = p.plusTen;
// CHECK-NEXT: 4
outputBuffer[15] = pointeeOfGeneric(p);
```

Proposed comment:

> Several of these cases each exist to cover one particular path, but the test doesn't say which. `pTuple.loadGeneric()` covers the `checkTupleSwizzleExpr` fallback. `pp.loadGeneric()` covers innermost-wins when a single generic extension matches both levels. `p.plusTen` covers a property, not a method. `pointeeOfGeneric` covers a generic pointee type. A one-line comment on each would tell a future maintainer what coverage they'd lose by deleting or changing it, which matters in a 17-output test where the indices carry no meaning.

Notes:
Low priority; the header comment covers the general behaviour.

### FG011: The interface-pointee test's buffer layout and test-directive choice are unexplained

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `tests/language-feature/extensions/ptr-extension-interface-pointee.slang:6-28`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files
- Overlap decision: Keep
- Overlap rationale: No other candidate covers this test's input layout.
- Scope decision: Direct
- Scope rationale: New test file added by this PR.

Context:

```slang
//TEST(compute):COMPARE_COMPUTE_EX(filecheck-buffer=CHECK):-cpu -compute -shaderobj -output-using-type
//TEST(compute):COMPARE_COMPUTE(filecheck-buffer=CHECK):-vk -emit-spirv-directly -output-using-type
...
// The buffer holds a serialized `Bar` existential (tag 2, value 2.0f), so `getVal` returns 3.
//TEST_INPUT: set pFoo = ubuffer(data=[0 0 2 0 2.0f], stride=4);
```

Proposed comment:

> The comment names two of the five words: a tag, 2, and a value, 2.0f. What are the leading `0 0` and the `0` after the tag? Unless the layout is spelled out, nobody can safely edit this input. The CPU line also uses `COMPARE_COMPUTE_EX ... -compute` while the sibling test and the other lines here use `COMPARE_COMPUTE`. If that's needed for existential inputs on CPU, please say so.

Notes:
Low priority test clarity.

## Dropped

### C005: The user-facing pointer documentation does not describe the new lookup behaviour

- Status: Drop
- Confidence: Low
- Scope: Contextual
- Category: comments
- Location: `tests/language-feature/extensions/ptr-extension-instance-member.slang:1-4`
- Overlap decision: Keep
- Overlap rationale: No overlapping candidate; C001 asks for an internal statement of the rule, this one asked for a user-facing one.
- Scope decision: Out-of-scope
- Scope rationale: The user guide's "Pointers" section is untouched and is still accurate, just incomplete; an author could fairly call a doc update optional for this PR.
- Judgment decision: Drop
- Judgment rationale: Anchoring a user-guide request on a test-file line would be awkward, and the guide isn't made misleading. The suggestion is moved into the review body as a non-blocking note instead.

Proposed comment:

> This changes what users can write. `p.g()` now reaches members of `extension Ptr<int>`. A pointee member of the same name hides them. `pp->g()` on a `Ptr<Ptr<int>>` now resolves, while `p->g()` on a `Ptr<int>` does not. A `DescriptorHandle<T>` level never contributes members. Today the only description of these rules is in test-file comments and internal doc comments. The user guide's "Pointers" section still says only that `.` dereferences. Should that section, or the extensions section, describe the rule, including the shadowing and the `->` cases, so that users and reviewers have one reference to check the tests against?

### FG005: `findPtrLevelWithMember` doc comment carries implementation rationale

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-impl.h:4275-4279`
- Overlap decision: Merged into C004
- Overlap rationale: Same lines and same concern (the justification for not reusing `lookUpMember`'s fallback); C004's comment now includes the suggestion to move it to an implementation comment.
- Scope decision: Direct
- Scope rationale: New doc comment in this PR.

Proposed comment:

> This paragraph explains why the implementation uses `NoDeref` instead of `lookUpMember`'s fallback. That's implementation rationale, not something a caller needs. It would sit better beside the `lookUpMember(..., LookupOptions::NoDeref)` call in the definition, where it also justifies that argument.

### FG006: "stand in for `T`" and "by design" in the PtrType-only filter are vague

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-expr.cpp:9477-9481`
- Overlap decision: Merged into C004
- Overlap rationale: Both ask why only `PtrType` levels are searched; C004 now quotes this loop comment and asks for the concrete rule and the #10962 reference.
- Scope decision: Direct
- Scope rationale: New comment in this PR.

Proposed comment:

> What does "stand in for `T`" mean precisely? That an extension on `ConstantBuffer<T>`/`Ref<T>` is not meant to be reachable through `.`? That such extensions can't exist? "By design" for `DescriptorHandle<T>` points to a decision (the PR description cites #10962) that the code doesn't reference. Since this filter decides which user-written extensions are reachable, please state the rule concretely, and link the design decision.

## Coverage Audit

- `source/slang/slang-check-expr.cpp`:
  - `visitIndexExpr`: FG008.
  - `visitInvokeExpr`: FG008.
  - `maybeDereference` body: the added assert and the list append are obviously correct given the doc; its contract wording is covered by FG009.
  - `checkTupleSwizzleExpr`: the signature change and four pass-through calls are mechanical and need no candidate.
  - `visitStaticMemberExpr`: FG007.
  - `maybeInsertImplicitOpForMemberBase`: C002.
  - `isMemberOnlyOnDerefedPtrTypes`: FG001, C002, C003.
  - `checkBaseForMemberExpr`: mechanical; its doc is covered by FG009.
  - `findPtrLevelWithMember`: C001, C004, FG003.
  - `checkGeneralMemberLookupExpr`: C006, FG004.
  - `visitMemberExpr`: the `needDeref` → `derefBases.getCount() == 0` change is equivalent, and passing `derefBases` through is mechanical; no candidate.
- `source/slang/slang-check-impl.h`:
  - `checkTupleSwizzleExpr` doc: clear.
  - `checkGeneralMemberLookupExpr` doc: terminology covered by FG002.
  - `findPtrLevelWithMember` doc: C001, C004.
  - `isMemberOnlyOnDerefedPtrTypes` doc: FG001.
  - `checkBaseForMemberExpr` and `maybeInsertImplicitOpForMemberBase` docs: FG009, C002.
  - `maybeDereference` doc: clear apart from the terminology anchor in FG002.
- `tests/bugs/ptr-extension-this-type.slang`: the `result=` prefix plainly makes the CHECK unambiguous; no candidate.
- `tests/diagnostics/pointer-extension-member-not-found.slang`: the header comment states the expected rules clearly; no candidate.
- `tests/language-feature/extensions/ptr-extension-instance-member.slang`: FG010.
- `tests/language-feature/extensions/ptr-extension-interface-pointee.slang`: FG011.

## Result (machine-readable)

```json
{"verdict":"APPROVE_WITH_NITS","bugs":0,"gaps":2,"questions":0,"diff_hash":"487dd36afafe242ccbddba5d38ed0d2174af81cdb219b1bc3498d95345f0ba6e","reviewers_complete":true}
```
