---
type: source
description: "slang-reviewer R1 combined review of PR #14317 (fixes #14295), 2026-11-04 20:15Z, head b920f03: REQUEST_CHANGES, B1 double evaluation through an interface pointee, remedy-14317-r1.patch. Verbatim memo; distilled into slang/14295-ptr-extension-instance-method-lookup.md."
okf_synth: exempt
---
# Combined PR Review — shader-slang/slang#14317 (pr, head b920f03)

## Reviewer verification (slang-reviewer, own runs)

**Verdict: REQUEST_CHANGES.** The fix is right for every pointer form in the issue, and for every extra form I tried, on cpu, vk and cuda. One bug remains, which A found and I confirmed on all three backends. When the pointee is an interface type, the pointer expression is evaluated twice (B1). Before this PR the same code failed with E30027, so the bug comes with the fix. Apply `remedy-14317-r1.patch` (+185/−8 on top of b920f03, tested: it fixes B1 and adds the missing pins). Then address the comment and contract items below and send a new `[Fix Review Request]`.

### What I ran

I built three Release trees with DXIL OFF and the same `libslang-llvm.so` (md5 c680a7be, v2026.21 prebuilt): `wt-14317-verify` (head b920f03), `wt-14317-base` (master 3da6f63c0) and `wt-14317-remedy` (head + remedy). The probes are in `runs/probe-14317/`. CI on the PR is skipped because it is a draft (53 jobs skipping), so these local runs are the only test evidence.

| Check | Head b920f03 | Master 3da6f63c0 | Head + remedy |
|---|---|---|---|
| PR tests (4 files, 6 runs) | 6/6 | 2/6: instance-member E39999 on cpu/vk/cuda; diagnostic test finds 4 unannotated errors. The strict `result=1` CHECK fails | pass |
| Full `slang-test -server-count 8` | 11514/11517 | the 3 failures also fail on master | 11517/11520 |
| Those 3 failures | `fp8-cuda{,-e5m2,-half-acc}` (cuda) | 0/3 on master too (host issue, see #13988) | same 3 |
| `slang-static-unit-test` (STATIC build) | 61 / 0 / 6 ignored | — | 61 / 0 / 6 ignored |
| Probe p1 (cpu/vk/cuda): `pp.which()`, `pp.outerOnly()`, `pp.loadGeneric()`, `p.twice` property, `p.stat()` static, `pp.advance()`, generic caller, `pp->which()` | 1, 3, 30, 20, 77, 40, 4, 1: all pass | E30027 ×11 | pass (now in the test) |
| Probe p3 (cpu/vk/cuda): `p.gg<1>()`, `pp->gg<3>()`, `(*pp).gg<4>()`, `getP().gg<7>()`, `(p + 3).gt(1)` | all pass (the `foo->Bar<42>()` re-check trap from #9810 does not recur) | E30027 | — |
| **B1**: `IFoo* nextEntry()`, then `nextEntry().tag()` (cpu/vk/cuda) | **`nextEntry` runs twice** (emitted C++ has two calls) | E30027 | runs once |
| `extension<T : IFoo> T { extra }` vs `extension<T> Ptr<T> { extra }`, `pFoo.extra()` | 7 | 7 | 7 (the naive remedy gave 8, see below) |
| clang-format 17 on the changed C++ | clean | — | clean |

### Findings

**🔴 B1: an interface pointee evaluates the pointer expression twice (A's bug, confirmed).** `maybeInsertImplicitOpForMemberBase` dereferences `e` to `*e : IFoo` and then calls `maybeOpenExistential`. That goes through `maybeMoveTemp` and `moveTemp`, which register `let tmp = *e` in the expression-local scope straight away (`slang-check-expr.cpp:92`). If the member is found only on a pointer level, `checkGeneralMemberLookupExpr:9465` swaps the base back to `e`. The `let` is still there, so `e` is evaluated in the `let` and again as `this`. Consider:

```slang
interface IFoo { int getVal(); }
extension<T> Ptr<T> { int tag() { return 10; } }
static int calls = 0;
IFoo* nextEntry() { calls++; return pFoo; }
...
outputBuffer[0] = nextEntry().tag();   // calls == 2 on head (cpu, vk and cuda)
```

A plain variable base (`pFoo.tag()`) hides the bug, because there the extra evaluation is a dead load. `nextInt().tag()` with an `int*` pointee evaluates once on head, so the bug needs the existential.

*Remedy, and a trap I hit on the way.* The level has to be chosen before the existential is opened. My first attempt was a pre-check that looked the member up on the *unopened* interface type. It fixed B1 but changed precedence. A lookup on `IFoo` itself does not find members of `extension<T : IFoo> T`, while the opened `ExtractExistentialType` does. So `pFoo.extra()` changed from the pointee's 7 (master and head) to the Ptr extension's 8. The patch uses a new helper, `isMemberOnlyOnDerefedPtrTypes`, to avoid this:
1. It runs only when a `Ptr` level has a member with that name, so other code takes the same path as before.
2. It then looks the name up on a stand-in `ExtractExistentialType`, built from a throwaway `VarDecl`. That adds no `let` and no container member.
3. If the opened value has no such member, `maybeInsertImplicitOpForMemberBase` (which now takes the `MemberExpr`) returns the base without opening it.

The general lookup then fails on `IFoo` exactly as before and falls back to the pointer level. The new `ptr-extension-interface-pointee.slang` (cpu/vk/cuda) pins all of this: one evaluation, an interface requirement still wins over a same-named Ptr member, and an `extension<T : IFoo> T` member still wins. On head it fails 0/3.

A suggests "open the existential only after lookup has settled on the pointee level". Any version of that must look up on the opened shape, not on the interface type, or it hits the same precedence change. If you choose a different design, such as rolling back the `ExprLocalScope` binding, keep the `pFoo.extra()` row.

**🟡 G1: which level wins is untested (A gap 1, C C004).** I checked this by reading the tests. No PR test has two pointer levels that both have the member, so reversing the loop at `:9427` would still pass. My probe shows that innermost-first holds (`pp.which()` is 1 when both `Ptr<int>` and `Ptr<Ptr<int>>` define `which`). It matches the recursion order of `_lookUpMembersInSuperTypeImpl` in `slang-lookup.cpp:587-610`. The patch adds `pp.level()` (1), `pp.outerOnly()` (130) and `pp.loadGeneric()` (30) to `ptr-extension-instance-member.slang`. Please also add the reason to the comment ("the same order as `lookUpMember`'s deref fallback").

**🟡 G2: the `->` rule is only half pinned (A gap 2, C C002).** The `while` at `:9421` runs only when level 0 is not a `Ptr`, and no test does that. The patch pins the current behaviour with two rows. `ConstantBuffer<Ptr<int>> cbPtr`: `cbPtr.g()` works and `cbPtr->g()` fails. `pp->outerOnly()` fails because `->` excludes level 0. If you prefer to read `cbPtr->g()` as `(*cbPtr).g()`, which succeeds, change the rule and the row together. Either way, say in the comment which level `->` consumes. Grammar: "does not contribute" → "do not contribute".

**🟡 G3: mutating, property and generic callers going through the base rewrite (A gap 3).** All three work: `pp.advance()` writes `*ptrSlot` (40), `p.plusTen` reads 20, and `pointeeOfGeneric(p)` gives 4. They had no test, and the patch adds them.

**❓ Q1: precedence is decided before visibility (C FG006).** `struct S { private int g(); }` together with `extension Ptr<S> { int g() }` makes `ps.g()` fail with E30600 (not accessible). The extension is never tried. **❓ Q2: by name, not by overload.** `S.m(int)` together with `extension Ptr<S> { int m() }` makes `ps.m()` fail with "not enough arguments", and for `Ptr<int>` with `extension Ptr<int> { int x() }`, `p.x()` takes the scalar swizzle (E30016). Both follow from "pointee members win", and lookup's own deref fallback behaves the same way. Please state the rule in the `checkGeneralMemberLookupExpr` comment ("a pointee member of that name, visible or not, hides the pointer levels") so that nobody mistakes it for an accident.

**📝 Comments and contracts.** I agree with A's 5 clarity comments and the overlapping C items (C001, C003, FG001–FG003, FG007, FG008, FG012, FG015):
- Say why the walk duplicates lookup's deref fallback. The reason is that lookup recurses through every `PointerLikeType` and would expose `DescriptorHandle<T>` members, which #10962 forbids.
- Reword "Only a `PtrType` has members of its own" as the #10962 policy. `DescriptorHandle` declares `equals`/`lessThan`.
- Document the base rewrite in the contract of `checkGeneralMemberLookupExpr`.
- `baseType = ptrBase->type;` is dead by A's trace, and I agree from reading the code.
- Mark the three callers that discard `derefBases` (`visitIndexExpr`, `visitInvokeExpr`, `visitStaticMemberExpr`) as deliberate.

**Disclosure.** The Risk line says "only code that failed before changes". That holds for what compiles, but code that used to fail now compiles with B1's double evaluation. After the remedy the line is accurate. The explanation's "`p->g()` unchanged" is also true, but `pp->g()` and `->` through a `ConstantBuffer` now follow a new rule (C). Mention that.

**Merge order with #14299 (jkwak-work, open).** #14299's second hunk in `tests/bugs/ptr-extension-this-type.slang` conflicts textually with this PR's CHECK change. Its first hunk, the `//DISABLE_TEST` plus the TODO at line 1, merges cleanly. So whichever PR lands second has to delete the `DISABLE_TEST` by hand while resolving the conflict, or the now-passing test is silently disabled again. Your R2 note covers the intent, so this is the mechanics.

### Disagreements

- **B (Devin) vs A.** Devin reported 0 bugs, 0 flags. A's B1 is real (reproduced above). Devin's commit-status freshness is `unknown`, so I can't tell whether it analysed b920f03.
- **A's suggested fix vs my test.** See the B1 trap. A lookup on the unopened interface type changes precedence for `extension<T : IFoo> T` members.
- **A and C** agree on the duplicate-fallback and policy-wording points. They don't contradict each other anywhere.

### Maintainer direction

Only one human maintainer comment gives design direction: kaizhangNV on #10962. jkwak-work's "@nv-slang-bot can you triage and make a pr?" on #14295 asks for work, not a design. The issue body was written by jkwak-work, but it counts as issue requirements, not maintainer direction.

| # | Requirement | Source | Status | Evidence |
|---|---|---|---|---|
| M1 | `DescriptorHandle<T>` member calls always go to `T`; members of `DescriptorHandle<T>` itself are not callable | [kaizhangNV, #10962](https://github.com/shader-slang/slang/issues/10962#issuecomment-4329895229) | **met** | `slang-check-expr.cpp:9429-9433` skips non-`Ptr` levels; `pointer-extension-member-not-found.slang` `t.h()` / `pt.h()` |
| I1 | The five failing forms compile and run: `extension Ptr<int>`, `extension<T> Ptr<T>`, `extension Ptr<S>`, `extension int*`, `extension Ptr<int> : IThing` | [issue body](https://github.com/shader-slang/slang/issues/14295) | **met** | `ptr-extension-instance-member.slang` rows 0–4 (cpu/vk/cuda) |
| I2 | The three working forms keep working: static call, `W<int>` struct, generic call | issue body | **met** | `ptr-extension.slang` passes; the generic `useFoo(p)` probe compiles |
| I3 | Re-enable `ptr-extension-this-type.slang` once fixed | issue body | **met** | enabled, with a strict `result=1` (fails on master); see the #14299 merge note |
| I4 | If by design: a better message and docs | issue body | n/a | not by design |

The fixer's self-check says R1 met, R2 met and R3 met, and I agree with all three. R3 is M1. The one addition is the #14299 mechanics above.

## Reviewer A — Correctness (nv-slang-bot)

**Verdict**: 🔴 Has issues: 1 bug, 3 gaps, 5 clarity comments

The PR records each implicitly dereferenced base in `derefBases`. When the fully dereferenced pointee has no member with the requested name, `lookUpMemberInDerefedPtrTypes` searches the `PtrType` levels, innermost first, and rewrites the member base to the level that matches. When the pointee is an interface, the rewrite leaves the existential-opening `let` binding in place, so the base expression is evaluated twice. No test covers which level wins when several match, or the `->` skip loop, and neither rule is explained. The new helper also duplicates the deref fallback that `lookUpMember` already has.

<details>
<summary>Changes Overview</summary>

**Member lookup through pointer levels** (`source/slang/slang-check-expr.cpp`, `source/slang/slang-check-impl.h`)
- What changed:
  - The `bool& outNeedDeref` out-parameter of `checkBaseForMemberExpr` → `maybeInsertImplicitOpForMemberBase` → `maybeDereference` is now `List<Expr*>& outDerefBases`, which records each pre-dereference expression, outermost first.
  - `checkGeneralMemberLookupExpr` (including the tuple-swizzle fallbacks) calls the new `lookUpMemberInDerefedPtrTypes` only when lookup in the pointee fails. On a match it replaces `expr->baseExpression` with that level.
  - For `->`, the first `PtrType` level and everything outside it are excluded. Levels that are not `PtrType` never contribute members.

**Tests** (`tests/language-feature/extensions/ptr-extension-instance-member.slang`, `tests/diagnostics/pointer-extension-member-not-found.slang`, `tests/bugs/ptr-extension-this-type.slang`)
- What changed:
  - A new cpu/vk/cuda compute test covers concrete, generic, `int*`, conformance, `[mutating]`, pointee-shadowing, nested-pointer and tuple-pointee extension members.
  - A new diagnostic test pins `p->g()`, `(*pp)->g()` and `DescriptorHandle` levels as errors.
  - The old `CHECK: 1` could match unrelated output, so it is tightened to `result=1`.

</details>

<details>
<summary>Findings (9 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🔴 Bug | `source/slang/slang-check-expr.cpp:9465` | With an interface pointee, the fallback leaves the existential `let` binding behind, so the base expression is evaluated twice |
| 🟡 Gap | `source/slang/slang-check-expr.cpp:9427` | No test or comment says which level wins when several pointer levels match (e.g. a generic `extension<T> Ptr<T>` on `Ptr<Ptr<int>>`) |
| 🟡 Gap | `source/slang/slang-check-expr.cpp:9421` | The `->` skip loop never runs in any test, and the comment doesn't say which level `->` dereferences |
| 🟡 Gap | `tests/language-feature/extensions/ptr-extension-instance-member.slang:108` | No tests for mutating calls, properties, or generic callers going through the base rewrite |
| 📝 Clarity | `source/slang/slang-check-expr.cpp:9411` | The helper duplicates the existing deref fallback in `_lookUpMembersInSuperTypeImpl` and doesn't say why |
| 📝 Clarity | `source/slang/slang-check-expr.cpp:9429` | "Only a `PtrType` has members of its own" is false (`DescriptorHandle` declares `equals`/`lessThan`/…), and a test locks the rule in |
| 📝 Clarity | `source/slang/slang-check-expr.cpp:9466` | The `expr->baseExpression` rewrite is undocumented, and `baseType = ptrBase->type;` has no effect |
| 📝 Clarity | `source/slang/slang-check-impl.h:4267` | The header contract leaves out the `->` and `PtrType`-only rules, and the name doesn't match the return value |
| 📝 Clarity | `source/slang/slang-check-expr.cpp:9103` | Three callers build `derefBases` and then discard it |

</details>

<sub>reviewed: b920f0375ac5addb91a521de7ea14ac5ffc141e8 · diff sha256 5758e327c9a5</sub>

---

### `source/slang/slang-check-expr.cpp:9465`

🔴 **Bug**: With an interface pointee, the fallback leaves the existential-opening temporary behind, so the pointer expression is evaluated twice

`maybeInsertImplicitOpForMemberBase` opens the existential on the dereferenced base before lookup.
1. For a base `e : Ptr<IFoo>`, `maybeDereference` produces `*e`. `maybeOpenExistential(*e)` then calls `openExistential`, which calls `maybeMoveTemp`.
2. `*e` is a `DerefExpr`, not a `VarExpr`, so it takes the `moveTemp` path. That path immediately registers `let tmp = *e` in the expression-local scope (`exprLocalScope->addBinding(letExpr);`, line 92).
3. If the member isn't on `IFoo`, this fallback replaces the base with `e`. The `let` stays registered, and `_CheckTerm` still wraps it around the finished term (`binding->body = checkedTerm;`, ~line 2340).
4. The result is `let tmp = *e in e.m()`, with the same `Expr` node `e` in two places. `visitLetExpr` lowers `initExpr` (`lowerLValueExpr(context, expr->decl->initExpr)`), and `visitDerefExpr` lowers its base (`lowerRValueExpr(context, expr->base)`). So `e` is lowered twice.

Before this PR, the lookup failed with E30027, so this path could not be reached.

**Example**:
```slang
interface IFoo { int getVal(); }
extension<T> Ptr<T> { int tag() { return 1; } }
RWStructuredBuffer<int> counter;
uniform IFoo* table;
IFoo* nextEntry() { InterlockedAdd(counter[0], 1); return table; }

[numthreads(1, 1, 1)]
void computeMain() { int t = nextEntry().tag(); }   // nextEntry() runs twice: counter[0] == 2, expected 1
```
With a plain variable base (`IFoo* p; p.tag()`), the extra evaluation is a dead alias. That is why the current tests don't catch it: none of them uses an interface pointee.

**Suggested fix**: Choose the level that owns the member before opening the existential. Two options:
- Open the existential only after lookup has settled on the pointee level.
- Run the pointer-level fallback before `maybeOpenExistential` when the pointee type has no member with that name.

Add a test modelled on `tests/language-feature/dynamic-dispatch/ptr-to-interface-deref.slang`. It should call a side-effecting function that returns `IFoo*` and check how many times it ran. It should also check that an `IFoo` requirement still wins over a `Ptr<IFoo>` extension member with the same name.

---

### `source/slang/slang-check-expr.cpp:9427`

🟡 **Gap**: Nothing tests or explains which pointer level wins when more than one matches

The loop counts down from `derefBases.getCount() - 1`, so the innermost `PtrType` level that has the member wins. This matters most for generic extensions, which match every level. Take the test's own `extension<T> Ptr<T> { T loadGeneric() { return *this; } }` with `Ptr<Ptr<int>> pp`:
- `pp.loadGeneric()` binds `this = *pp` and returns `**pp : int`, not `*pp : Ptr<int>`.
- A `[mutating]` generic member found the same way updates the pointer stored at `*pp`, not `pp`.
- Neither `.` nor `->` can call a generic `Ptr<T>` member with `pp` itself as `this`.

This matches the recursion order in `_lookUpMembersInSuperTypeImpl` (`slang-lookup.cpp:587-610`), so it may well be intended. But the header states the order without giving a reason. The only multi-level test, `pp.loadPlusOne()`, has just one matching level. Reversing the loop, or stopping after the first `Ptr` level, would pass every current test.

**Suggestion**: Add a sentence explaining why innermost-first is the rule, and pin it with a test in `ptr-extension-instance-member.slang`:
```slang
extension Ptr<Ptr<int>> { int level() { return 2; } int outerOnly() { return **this + 100; } }
extension Ptr<int>      { int level() { return 1; } }
extension<T> Ptr<T>     { int pointeeSize() { return sizeof(T); } }

outputBuffer[..] = pp.level();        // CHECK: 1   (both levels match; innermost wins)
outputBuffer[..] = pp.pointeeSize();  // CHECK: 4   (generic matches every level; T == int)
outputBuffer[..] = pp.outerOnly();    // CHECK: 130 (only level 0 matches; this == pp)
```
Also add a diagnostic case for `pp->outerOnly()`, which should fail because `->` excludes level 0.

---

### `source/slang/slang-check-expr.cpp:9421`

🟡 **Gap**: The `->` skip loop never runs in any test, and the comment doesn't say which level `->` dereferences

`visitMemberExpr` accepts `->` on any base that was implicitly dereferenced, not only a `PtrType` (`derefBases.getCount() == 0 && as<DerefMemberExpr>(expr) && !as<PtrType>(...)`). This loop instead treats `->` as consuming the first `PtrType` level, and passes over any non-`Ptr` pointer-like levels in front of it.

The `while` body only runs when `derefBases[0]` is not a `PtrType`. Every new `->` test (`p->g()`, `pp->g()`, `(*pp)->g()`, `pp->loadPlusOne()`) has a `PtrType` at index 0, so deleting the `while` would leave every test passing.

**Example**: take `extension Ptr<int> { int g() }` and `ConstantBuffer<Ptr<int>> cbPtr;`, a shape that already appears in `tests/spirv/ptr-subscript.slang`.
- `derefBases` is `[cbPtr, *cbPtr]`, and the loop stops at index 1.
- So `cbPtr->g()` is rejected, while `cbPtr.g()` binds `this = *cbPtr`.
- If `->` is read as `(*cbPtr).g()`, the opposite result follows.

When no level is a `PtrType` (`cb->m` with `cb : ConstantBuffer<S>`), `outermostLevel` ends at `getCount() + 1`. The search loop is then skipped only because of that past-the-end value.

**Suggestion**: Say in the comment which level `->` consumes and why. A small named helper that returns the first searchable level would make the result obvious. Add a diagnostic case that pins the intended result:
```slang
ConstantBuffer<Ptr<int>> cbPtr;
int arrowThroughConstantBuffer() { return cbPtr.g() + cbPtr->g(); }
```
Minor: in the comment above, "does not contribute members" should be "do not contribute members".

---

### `tests/language-feature/extensions/ptr-extension-instance-member.slang:108`

🟡 **Gap**: No tests for mutating calls, properties, or generic callers going through the base rewrite

The fallback rewrites the member base to a synthesized `*pp` (`expr->baseExpression = ptrBase;`). It also uses `LookupMask::Default`, so it can return any kind of member. The tests cover only methods, and the only `[mutating]` call (`cursor.advance()`) is at level 0, on a local variable. These newly accepted forms are not exercised:
- **`pp.advance()`**: a mutating call through an inner level. It must write the advanced pointer back through `pp` into `*ptrSlot`.
- **Pointer-extension properties**: for example, reading `p.plusTen` for `property int plusTen { get { return *this + 10; } }`, and calling a setter through `pp`.
- **Generic callers**: for example, `int sz<T>(Ptr<T> pt) { return pt.pointeeSize(); }`, where lookup on `T` fails before the fallback runs.

**Suggestion**: add a test like this one:
```slang
pp.advance();                       // *ptrSlot: intPtr+2 -> intPtr+3
// CHECK-NEXT: 40
outputBuffer[N] = **ptrSlot;
```
Also add a `p.plusTen` property read and a generic-caller case.

Separately, this comment uses "the dereferenced base" to mean `*pp`. Elsewhere in the PR (the comment in `checkGeneralMemberLookupExpr` and the diagnostic test header), the same phrase means the fully dereferenced `**pp`. Wording such as "is called with `*pp` as `this`" would keep the term consistent.

---

### `source/slang/slang-check-expr.cpp:9411`

📝 **Clarity**: The comments don't explain how this relates to the deref fallback `lookUpMember` already has

`lookUpMember` already does this. `_lookUpMembersInSuperTypeImpl` (`slang-lookup.cpp:585-610`) dereferences a pointer-like type and looks in the pointee. Only if that finds nothing does it look in the pointer type itself. It leaves a `Deref` breadcrumb, which `createLookupResultExpr` turns back into `*p`. Because it recurses, it already produces the innermost-pointer-first order documented here.

The checker never reaches that path for `p.m` only because `maybeDereference` has already stripped the base to its fully dereferenced form. The swizzle/tuple dispatch, the `->` check and `maybeOpenExistential` all need that form.

This helper walks the levels again with `LookupOptions::NoDeref`, and adds two policies of its own:
- only `PtrType` levels count;
- `->` skips its own pointer.

Neither this definition nor the header explains why the existing lookup can't serve as the fallback, for example by calling `lookUpMember` on `derefBases[start]->type` without `NoDeref`. Nor do they explain why the two policies belong in the checker rather than in lookup. As written, the rule "pointee members win, then the pointer type's" now lives in two places that can drift apart. They already disagree about `DescriptorHandle<T>` (see the comment on line 9429).

Please explain how the two mechanisms relate and why a separate walk is needed. Alternatively, move the policies into one place, per CLAUDE.md "Keep one source of truth".

---

### `source/slang/slang-check-expr.cpp:9429`

📝 **Clarity**: The `PtrType`-only rule is presented as a property of the types, but it is a policy

"Only a `PtrType` has members of its own here" isn't true:
- `struct DescriptorHandle<T:IOpaqueDescriptor> : IComparable` declares `equals`, `lessThan` and `lessThanOrEquals` (`hlsl.meta.slang:29201-29252`).
- Users can extend it, as the new diagnostic test does with `extension<T : IOpaqueDescriptor> DescriptorHandle<T> { int h() }`.

What keeps those members out of reach through `.` is this `continue`. `pointer-extension-member-not-found.slang` then locks the restriction in as intended behavior ("A `DescriptorHandle<T>` level never contributes members, even under a pointer"). As a result, `t.h()` reports `'h' is not a member of 'Texture2D<vector<float,4>>'` even though the user declared `h` on the handle type. The same extension shape on `Ptr<int>` works.

Please say why only `PtrType` levels are searched. There are two possibilities:
- **Non-`Ptr` pointer-like types are meant to be transparent stand-ins for `T`.** Then say so, and reference #10962 if that issue is the reason.
- **This PR is deliberately limited to `Ptr`.** Then describe the `DescriptorHandle` test cases as a known limitation rather than intended behavior.

---

### `source/slang/slang-check-expr.cpp:9466`

📝 **Clarity**: The base rewrite is undocumented, and `baseType = ptrBase->type;` has no effect

The fallback now changes `expr->baseExpression` in place, from the fully dereferenced base (`**pp`) to a pointer-level expression (`*pp`). That is how `createLookupResultExpr` ends up passing the pointer as `this`. This is a new side effect of `checkGeneralMemberLookupExpr`, but its declaration comment in `slang-check-impl.h` only says what `derefBases` holds. Please add to the contract that the function may fall back to a pointer level and replace the base.

As far as I can trace, nothing ever sees the `baseType` reassignment:
- After this point, `baseType` is read only by `lookupMemberResultFailure(expr, baseType, diagnosed)`.
- Once the fallback has produced a valid result, that call is reachable only if `filterLookupResultByVisibilityAndDiagnose` or `filterLookupResultByCheckedOptionalAndDiagnose` empties the result.
- Both filters set `outDiagnosed = true` when they do (lines 1331-1336 and 1426-1431).
- `lookupMemberResultFailure` reads `baseType` only when `!supressDiagnostic`.

If no path makes it matter, please delete the assignment. If one does, a comment naming that path would help.

---

### `source/slang/slang-check-impl.h:4267`

📝 **Clarity**: The declared contract leaves out the two rules that change the result

`derefBases` holds every pointer-like level, since `maybeDereference` records `DescriptorHandle<T>` and `ConstantBuffer<T>` levels too. But the body searches only `PtrType` levels. For `p->m`, it also excludes the pointer that `->` dereferences and everything outside it.

From this doc alone, you would expect `p->g()` with `p : Ptr<int>` to find `g` from `extension Ptr<int>`. The new diagnostic test asserts that it errors. Both rules appear only in inline comments in the `.cpp` file.

The name also reads like a plain lookup. In fact the function searches for and returns the matching base expression (or null), with the lookup result as an out-parameter. A name that says what comes back, such as `findPtrLevelWithMember`, would make the call site in `checkGeneralMemberLookupExpr` easier to read. Please state both rules in the doc.

---

### `source/slang/slang-check-expr.cpp:9103`

📝 **Clarity**: Three callers build `derefBases` and then discard it

`visitStaticMemberExpr` (here), `visitIndexExpr` (line 3611) and `visitInvokeExpr` (line 5368) each declare a `List<Expr*> derefBases` that gets filled and is never read. In `visitStaticMemberExpr` the local is new, because `maybeDereference` previously had no out-parameter.

A reader can't tell which of these is the case:
- `v::m`, `p[i]` and `p(...)` deliberately don't see members declared on the pointer type, even though `v.m` now does;
- the locals exist only because the new signature requires one.

Please make the intent explicit, either with a note at these call sites or by making the out-parameter optional (`List<Expr*>* outDerefBases = nullptr`). With an optional parameter, callers that don't need the list don't have to declare a placeholder.

## Reviewer B — Devin Review

# Devin Review

## AI Analysis

Member lookup on a pointer value now falls back to extension members of the pointer types it was dereferenced through. Pointee members still win, so only code that previously failed with E30027 changes.

Records every implicitly dereferenced pointer expression in a list instead of a single needDeref flag.
Searches that list innermost first for an extension member when the dereferenced base has none.
Leaves p->m lookup unchanged by skipping the pointer that the arrow dereferences.
Show less

Summary: p.g() failed with E30027 when g comes from extension Ptr<int> (or int*, Ptr<S>, extension<T> Ptr<T>). When the pointee has no such member, member lookup now also looks in each Ptr type that the base was dereferenced through.

Root cause: maybeDereference (slang-check-expr.cpp:8417) turns p into *p before lookup, so checkGeneralMemberLookupExpr (:9452) only searched the pointee type.

Tests: new ptr-extension-instance-member.slang (cpu/vk/cuda) and pointer-extension-member-not-found.slang; ptr-extension-this-type.slang CHECK made strict. Full slang-test passes except 3 fp8-cuda tests that fail on master on this host.

Risk: front-end only; pointee members still win, so only code that failed before changes. p->g() and DescriptorHandle<T> (#10962) are unchanged.

Fixes #14295

🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.

Show less
325 lines left
1
Replace needDeref with a list of dereferenced bases
0/2
2
Look up members in the dereferenced pointer types
0/1
3
Make the strict extension test and add new tests
0/3
End of changes
Chat about this PR
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

# PR 14317 Clarity Review Workflow

## PR Summary

PR #14317, "Find extension members of a pointer type through a pointer value" (author `app/nv-slang-bot`, +293/−32, fixes #14295). Head `b920f0375ac5addb91a521de7ea14ac5ffc141e8`.

What the description says: before this PR, `p.g()` failed with E30027 when `g` came from `extension Ptr<int>` (or `int*`, `Ptr<S>`, `extension<T> Ptr<T>`). The cause is that `maybeDereference` rewrites `p` to `*p` before member lookup. With the PR, when the pointee has no member of that name, lookup also tries each `Ptr` type the base was dereferenced through. Pointee members still win, and `p->g()` and `DescriptorHandle<T>` behave as before.

What the diff does:

- Replaces the `bool& outNeedDeref` flag with a `List<Expr*>& outDerefBases` that records every implicitly dereferenced level, outermost first. The list is threaded through `maybeDereference`, `maybeInsertImplicitOpForMemberBase`, `checkBaseForMemberExpr`, `checkTupleSwizzleExpr`, and `checkGeneralMemberLookupExpr`. Three callers ignore it: `visitIndexExpr`, `visitInvokeExpr`, `visitStaticMemberExpr`.
- Adds `lookUpMemberInDerefedPtrTypes`, which searches the recorded `PtrType` levels innermost-first with `LookupOptions::NoDeref`. It skips non-`PtrType` levels. For `->` it also skips the first `PtrType` level and every level outside it.
- In `checkGeneralMemberLookupExpr`, when the pointee lookup fails and a pointer level has the member, rewrites `expr->baseExpression` to that level.
- Adds a CPU/VK/CUDA runtime test and an exhaustive diagnostic test, and tightens a pre-existing interpreter test (`CHECK: 1` → `CHECK: result=1`). The old CHECK could match a digit in an error message.

Mismatches with the description:

- "`p->g()` unchanged" undersells the change. Before, `->` and `.` produced identical bases. Now `->` has its own rule for which pointer levels may contribute members, e.g. `pp->g()` succeeds and `(*pp)->g()` fails.
- "`DescriptorHandle<T>` unchanged" is now locked in by a new negative test that shows extension members on `DescriptorHandle<T>` can't be called with `.`.
- The described root cause (eager dereference in `maybeDereference`) is left in place. The fix is a post-hoc fallback beside the existing pointee-then-pointer logic in `slang-lookup.cpp`.

Value: a real user-facing fix, confined to the front end, with good positive and negative tests. The comments are mostly well written and give concrete examples.

## Review Body

> Claude Opus 5.5-authored clarity review:
>
> This is a small, well-scoped front-end fix with good tests. The new runtime test covers the interesting shapes (generic `Ptr<T>` extensions, `int*` spelling, `[mutating]`, pointee shadowing, tuples, double pointers), and the exhaustive diagnostic test pins the negative cases. The new doc comments mostly follow the repo's "Consider:" style. From a clarity standpoint the PR is fairly close to merge-ready. The main gap is that several new language-level decisions are made in code without being stated as decisions, so a reader can't tell which behaviours are intended rules and which are side effects of the implementation.
>
> ## Main Concerns
>
> - **Second implementation of an existing rule.** `lookUpMember` already does "pointee first, then the pointer type's own members" via a `Deref` breadcrumb in `_lookUpMembersInSuperTypeImpl`. The PR adds a parallel loop plus a manual base rewrite. That may be justified (eager dereference is load-bearing for swizzles and existential opening), but the reason should be written down, and so should which of the two rules is authoritative.
> - **What `->` dereferences.** The PR gives `->` a new meaning: it consumes one pointer level. That level is computed as "first `PtrType` in `derefBases`", which doesn't match the stated model "`p->m` names a member of `*p`" when an outer level isn't a `PtrType`, and doesn't match the predicate `visitMemberExpr` uses to accept `->`. No test exercises the skipping loop.
> - **Why only `PtrType`.** The comment says other pointer-like types "have no members of their own", but the new test gives `DescriptorHandle<T>` one. The test then locks in that it's unreachable. Please state the real reason, and say whether that's the intended rule or a known limitation.
> - **Precedence and contracts.** Innermost-first ordering across levels is a semantic choice with no stated rationale and no test that distinguishes it. `checkGeneralMemberLookupExpr` now rewrites `expr->baseExpression`, and the new helper's declaration omits its filtering rules. Neither contract says so.
>
> The remaining comments are small naming, terminology, and contract nits that should be quick to address.

## Kept

### C001: Parallel re-implementation of the existing pointee-first, then pointer, lookup

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: organization
- Location: `source/slang/slang-check-expr.cpp:9411`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-b7b702547708573d4fbc777cabe8a3a8689d0bb6a432dcf85dc3c04895151e4bR9411
- Scope decision: Direct
- Scope rationale: Concerns the design of a new helper introduced by the PR and the new base-rewrite mechanism it feeds.
- Overlap decision: Keep
- Overlap rationale: Absorbs FG005 (the unexplained `NoDeref`), since both concern how the new loop relates to the existing breadcrumb lookup.
- Judgment decision: Keep
- Judgment rationale: Confirmed that `lookUpMember` → `_lookUpMembersInType` → `_lookUpMembersInSuperTypeImpl` (slang-lookup.cpp:585-607) searches the pointee first with a `Deref` breadcrumb and falls back to the pointer's own declarations, and that `createLookupResultExpr` (slang-check-expr.cpp:964) turns `Deref` breadcrumbs into `ConstructDerefExpr`. So the overlap is real. The comment is phrased as a request for justification, not a demand to refactor.

Context:

```cpp
Expr* SemanticsVisitor::lookUpMemberInDerefedPtrTypes(
    MemberExpr* expr,
    List<Expr*> const& derefBases,
    LookupResult& outLookupResult)
{
    ...
    for (Index level = derefBases.getCount() - 1; level >= outermostLevel; level--)
    {
        ...
        LookupResult lookupResult = lookUpMember(
            m_astBuilder, this, expr->name, ptrBase->type, m_outerScope,
            LookupMask::Default, LookupOptions::NoDeref);
```

Existing code in `slang-lookup.cpp` (`_lookUpMembersInSuperTypeImpl`):

```cpp
// If the type was pointer-like, then dereference it
// automatically here.
if (((uint32_t)request.options & (uint32_t)LookupOptions::NoDeref) == 0)
{
    if (auto pointerElementType = getPointedToTypeIfCanImplicitDeref(superType))
    {
        ... derefBreacrumb.kind = LookupResultItem::Breadcrumb::Kind::Deref;
        _lookUpMembersInType(astBuilder, name, pointerElementType, ...);
        if (ioResult.isValid())
            return;
    }
}
// Default case: no dereference needed
```

Proposed comment:

> It isn't clear why this needs a second implementation of "look in the pointee first, then fall back to the pointer type's own members". `lookUpMember` already does that in `_lookUpMembersInSuperTypeImpl` (`slang-lookup.cpp`): it searches the pointee, leaves a `Deref` breadcrumb, and falls back to the pointer type's own declarations only when the pointee lookup fails. `createLookupResultExpr` then turns those breadcrumbs back into `DerefExpr`s. That path doesn't help for `p.g()` only because `maybeDereference` has already removed every pointer level before lookup runs.
>
> This helper adds a second mechanism: record each removed level in `derefBases`, search them innermost-first with `NoDeref`, and then rewrite `expr->baseExpression` by hand. As far as I can tell, the two differ only in the `PtrType`-only filter and the `->` rule. Could you explain in the code why the existing breadcrumb path can't do this work, e.g. by retrying lookup at the base's pointer type? If the reason is "that would also expose `DescriptorHandle`/`ConstantBuffer` members" or "swizzles and existential opening need the dereferenced base first", stating it here tells a future maintainer which of the two precedence rules is authoritative. If the loop stays, please also say why `NoDeref` is required: it keeps each iteration to exactly one level, rather than re-searching the already-failed pointee and re-finding inner levels through breadcrumbs.

### C002: The `->` rule introduces "the pointer that `->` dereferences" without defining it

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-expr.cpp:9416-9425`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-b7b702547708573d4fbc777cabe8a3a8689d0bb6a432dcf85dc3c04895151e4bR9416
- Scope decision: Direct
- Scope rationale: The `->` level-exclusion logic and its comment are new in this PR, and the PR rewrote the `->` validity check in `visitMemberExpr`.
- Overlap decision: Keep
- Overlap rationale: Absorbs FG004 (the `outermostLevel` naming and bound) and FG009 (the divergent `->` predicate in `visitMemberExpr`), which are local symptoms of the same undefined concept.

Context:

```cpp
    // `p->m` names a member of `*p`, so the pointer that `->` dereferences, and any level
    // outside it, does not contribute members.
    Index outermostLevel = 0;
    if (as<DerefMemberExpr>(expr))
    {
        while (outermostLevel < derefBases.getCount() &&
               !as<PtrType>(derefBases[outermostLevel]->type))
            outermostLevel++;
        outermostLevel++;
    }
```

and in `visitMemberExpr`:

```cpp
    if (derefBases.getCount() == 0 && as<DerefMemberExpr>(expr) &&
        !as<PtrType>(expr->baseExpression->type))
```

Proposed comment:

> Before this PR, `->` and `.` produced the same base: `maybeDereference` removes every level for both, and `->` only affected the "cannot dereference" diagnostic. Here `->` gets a semantic role: it consumes one pointer level. That level is never defined, though. The comment says "`p->m` names a member of `*p`", but the code defines the consumed level as the *first `PtrType`* in `derefBases` and skips any outer non-`PtrType` levels. Meanwhile `visitMemberExpr` accepts `->` as soon as *any* level was dereferenced, including a `ConstantBuffer`.
>
> These rules diverge when an outer level isn't a `PtrType`, e.g. `ConstantBuffer<Ptr<S>> cb; cb->g()`. Read literally, "`p->m` is a member of `*p`" makes `*cb : Ptr<S>`, so the `Ptr<S>` level would contribute. The loop instead treats `->` as consuming that level. Could you state precisely which level `->` consumes, and why outer pointer-like levels are skipped? It would also help to compute that level in one named place that both this helper and the `visitMemberExpr` check use. As written, `outermostLevel` is really "the first level allowed to contribute": one past the first `PtrType`, or `getCount() + 1` when there is none. The trailing `outermostLevel++` is easy to misread as part of the `while`. Finally, no current test advances the `while` loop, because every `->` test has a `PtrType` at level 0. Either add a test that pins the skipping behaviour, or simplify if that shape can't occur.

### C003: The `PtrType`-only policy is stated as a property of the types rather than as a decision

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: correctness smell
- Location: `source/slang/slang-check-expr.cpp:9429-9433`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-b7b702547708573d4fbc777cabe8a3a8689d0bb6a432dcf85dc3c04895151e4bR9429
- Scope decision: Direct
- Scope rationale: New comment and filter in a new helper, plus a new test that locks in the resulting behaviour.
- Overlap decision: Keep
- Overlap rationale: Distinct from FG012 (which is about the "pointer-like" vocabulary). This candidate asks for the rationale behind the policy.

Context:

```cpp
        // Only a `PtrType` has members of its own here. Other pointer-like types, such as
        // `DescriptorHandle<T>` and `ConstantBuffer<T>`, forward all member lookup to `T`.
        Expr* ptrBase = derefBases[level];
        if (!as<PtrType>(ptrBase->type))
            continue;
```

and in `tests/diagnostics/pointer-extension-member-not-found.slang`:

```slang
// ... A
// `DescriptorHandle<T>` level never contributes members, even under a pointer.

extension<T : IOpaqueDescriptor> DescriptorHandle<T>
{
    int h() { return 1; }
}
...
    return t.h();
//CHECK:     ^ member not found
```

Proposed comment:

> "Only a `PtrType` has members of its own here" doesn't seem accurate. The new diagnostic test gives `DescriptorHandle<T>` a member `h` through an extension, and as far as I can tell `lookUpMember` on `DescriptorHandle<Texture2D>` without `NoDeref` would find it. Those members are skipped because of a choice made here, not because the types have none. "Forward all member lookup to `T`" describes what eager `maybeDereference` does, not a property of `DescriptorHandle` or `ConstantBuffer`. The `continue` also silently skips `ExplicitRefType` levels, which the comment doesn't mention.
>
> Could you state the actual reason only `PtrType` levels contribute? For example: compatibility with existing `DescriptorHandle` lookup (the PR description mentions #10962), avoiding ambiguity with resource methods, or something else. Please also say whether "a `DescriptorHandle` extension member is never callable with `.`" is the intended language rule or a known limitation. The diagnostic test currently locks it in as expected behaviour. If it's a limitation, the test comment should say so, so nobody later reads it as a spec.

### C004: Precedence between pointer levels (innermost first) has no stated rationale or distinguishing test

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-impl.h:4257`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-de6635fcced55ee0d7f18e86d265f8a58e13fca3b40ac0123ce0ef14306d40eaR4257
- Scope decision: Direct
- Scope rationale: The ordering is a new semantic choice made by the PR's new helper and documented in its new doc comment.
- Overlap decision: Keep
- Overlap rationale: Different from FG002 (missing filter rules in the contract). This asks for the rationale and a test for the ordering.

Context:

```cpp
    /// Look up the member named by `expr` in the pointer types that the base of `expr` was
    /// implicitly dereferenced through, given as `derefBases` (outermost first). Return the
    /// base at the innermost level whose pointer type has the member, ...
```

Proposed comment:

> Searching innermost-first is an observable language choice whenever more than one level has a member of the name. With `extension<T> Ptr<T> { T loadGeneric() }` and `pp : Ptr<Ptr<int>>`, `pp.loadGeneric()` resolves at `*pp : Ptr<int>` and returns `int`. Searching outermost-first would return `Ptr<int>`. The comment says *what* the order is but not *why*. Presumably nearer levels shadow farther ones, by analogy with "pointee members win". The tests don't distinguish the two orders either, since `pp.loadPlusOne()` only matches at one level. Please state the rationale and add a case where two levels both match. The new test already declares `loadGeneric` and `pp`, so this could be a single extra line.

### C005: Which member-access forms get the new fallback is implied only by which callers discard `derefBases`

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: API shape
- Location: `source/slang/slang-check-expr.cpp:9103`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-b7b702547708573d4fbc777cabe8a3a8689d0bb6a432dcf85dc3c04895151e4bR9103
- Scope decision: Direct
- Scope rationale: The PR added the `derefBases` locals at each discarding call site and decides which paths get the fallback.
- Overlap decision: Keep
- Overlap rationale: Absorbs FG010, which made the same request at `visitIndexExpr` with less context.
- Judgment decision: Revise
- Judgment rationale: Checked that `visitStaticMemberExpr` passes the dereferenced base to `_lookupStaticMember`, and that `visitInvokeExpr` looks up `operator()` with `NoDeref` on the dereferenced type. So `p.staticFn()` and `p::staticFn()` now really do differ for `Ptr` extension statics. The PR description's "member lookup" framing suggests this is intentional, so the comment is narrowed to asking for the scope to be documented.

Context:

```cpp
    // Not sure this is needed -> but guess someone could do
    List<Expr*> derefBases;
    expr->baseExpression =
        maybeDereference(expr->baseExpression, CheckBaseContext::Member, derefBases);
```

(and likewise `visitIndexExpr` at line 3611 and `visitInvokeExpr` at line 5368, which create a `derefBases` list and never read it)

Proposed comment:

> Three of the callers that now produce `derefBases` discard it: `visitStaticMemberExpr` here, `visitIndexExpr`, and `visitInvokeExpr`. The forms that get the new "also search the pointer types" fallback are therefore implied only by which callers ignore the list. For example, `p.staticFn()` would find a static member of `extension Ptr<int>`, but `p::staticFn()` would not, and neither would an `operator()` declared in a `Ptr` extension. If that split is intentional, please add a sentence where the fallback is applied, saying which member-access forms it covers and why the others are excluded. A reader can then tell an intentionally ignored list from an accidentally dropped one.

### FG001: `lookUpMemberInDerefedPtrTypes` is a search that returns the base, not the member

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: naming
- Location: `source/slang/slang-check-impl.h:4267`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-de6635fcced55ee0d7f18e86d265f8a58e13fca3b40ac0123ce0ef14306d40eaR4267
- Scope decision: Direct
- Scope rationale: Name of a new function introduced by the PR.
- Overlap decision: Keep
- Overlap rationale: No other candidate addresses the name and return-value mismatch.

Context:

```cpp
    Expr* lookUpMemberInDerefedPtrTypes(
        MemberExpr* expr,
        List<Expr*> const& derefBases,
        LookupResult& outLookupResult);
```

Proposed comment:

> The name suggests a lookup that produces a member. The return value is actually the *base expression* where the member was found, or null when no level has it. The member itself comes back through `outLookupResult`. So the call site reads `if (auto ptrBase = lookUpMember...(...))`, and nothing in the name explains why a "member lookup" yields a base. A name that says what is returned, and that this is a nullable search (`find...`), would make the call site self-explanatory. "Derefed" is also a new abbreviation. Nearby code spells it `deref`/`Deref` (`constructDerefExpr`, `DerefExpr`, `derefBases`) or "dereferenced" in prose.

### FG002: The new helper's doc comment omits its caller-visible filtering rules

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-impl.h:4255-4258`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-de6635fcced55ee0d7f18e86d265f8a58e13fca3b40ac0123ce0ef14306d40eaR4255
- Scope decision: Direct
- Scope rationale: New doc comment on a new declaration.
- Overlap decision: Keep
- Overlap rationale: C002 and C003 ask for the rationale behind the rules. This asks for the rules to appear in the declaration-level contract.

Context:

```cpp
    /// Look up the member named by `expr` in the pointer types that the base of `expr` was
    /// implicitly dereferenced through, given as `derefBases` (outermost first). Return the
    /// base at the innermost level whose pointer type has the member, with the lookup result in
    /// `outLookupResult`, or null when no level has it.
```

Proposed comment:

> The declaration says the helper searches "the pointer types that the base was implicitly dereferenced through". The body searches only the `PtrType` levels among them, and for `->` it also excludes the level `->` dereferences and everything outside it. Both rules change which members a caller can reach, so they belong in this contract and not only in implementation comments in the `.cpp`. A caller reading only the declaration would expect `DescriptorHandle<T>` or `ConstantBuffer<T>` levels to be searched, and the `p` in `p->g()` too. Please also say that `outLookupResult` is left untouched on failure, since the caller passes in its own invalid result.

### FG003: `checkGeneralMemberLookupExpr` now rewrites `expr->baseExpression`, but its contract doesn't say so

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-expr.cpp:9465-9466`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-b7b702547708573d4fbc777cabe8a3a8689d0bb6a432dcf85dc3c04895151e4bR9465
- Scope decision: Direct
- Scope rationale: New side effect added to a function whose signature and body the PR changed.
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the new mutation of `expr->baseExpression` or the `baseType` reassignment.

Context:

```cpp
    if (!lookupResult.isValid())
    {
        // Members of the dereferenced base win; only when it has none do we look in the
        // pointer types that it was dereferenced through.
        if (auto ptrBase = lookUpMemberInDerefedPtrTypes(expr, derefBases, lookupResult))
        {
            expr->baseExpression = ptrBase;
            baseType = ptrBase->type;
        }
    }
```

and in the header:

```cpp
    // Check a member expr as a general member lookup.
    // This is the default/fallback behavior if the base type isn't swizzlable.
    // `derefBases` holds the expressions that the base of `expr` was implicitly dereferenced
    // through, as reported by `checkBaseForMemberExpr`.
```

Proposed comment:

> `checkGeneralMemberLookupExpr` can now replace `expr->baseExpression`, and the local `baseType`, with one of the `derefBases`. For `pp.g()` the base goes from `**pp` back to `*pp`, which is what makes `*pp` the `this` argument. The header comment only describes `derefBases` as an input, and doesn't say the function may undo part of the implicit dereference. Please add that to the contract. It's also unclear why `baseType` is reassigned. After the rewrite it is read only by `lookupMemberResultFailure`, on the path where visibility or checked-optional filtering rejects the pointer-type member. If keeping `baseType` in sync with `expr->baseExpression` is an invariant the rest of the function relies on, one sentence would say so. Otherwise the reader has to work out whether the assignment matters.

### FG006: "Only when it has none" is decided before visibility filtering

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: control flow
- Location: `source/slang/slang-check-expr.cpp:9461-9462`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-b7b702547708573d4fbc777cabe8a3a8689d0bb6a432dcf85dc3c04895151e4bR9461
- Scope decision: Direct
- Scope rationale: New precedence comment and the new fallback's position relative to existing filtering.
- Overlap decision: Keep
- Overlap rationale: A distinct question about visibility versus precedence. FG003 covers the base rewrite in the same block.

Context:

```cpp
    LookupResult lookupResult =
        lookUpMember(m_astBuilder, this, expr->name, baseType, m_outerScope);
    if (!lookupResult.isValid())
    {
        // Members of the dereferenced base win; only when it has none do we look in the
        // pointer types that it was dereferenced through.
        ...
    }
    bool diagnosed = false;
    lookupResult = filterLookupResultByVisibilityAndDiagnose(lookupResult, expr->loc, diagnosed);
```

Proposed comment:

> The precedence check runs on the unfiltered lookup result. A pointee member that is *not visible* from the use site (e.g. a `private` member of `S`) therefore still hides a visible `extension Ptr<S>` member of the same name, and the user gets an inaccessibility error instead of the extension call. That may well be the intended name-hiding rule, but "only when it has none" doesn't say whether "none" means "no member of that name at all, regardless of visibility". Please state which is meant.

### FG007: "Dereferenced base" refers to two different expressions

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: terminology
- Location: `tests/language-feature/extensions/ptr-extension-instance-member.slang:108`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-e006160df60596fb03a6539d246d6405d690386b6de47ca069b73196b19f7254R108
- Scope decision: Direct
- Scope rationale: Both conflicting uses are in comments added by the PR.
- Overlap decision: Keep
- Overlap rationale: Terminology-only concern, not covered elsewhere.

Context:

```slang
    // A member found on an inner pointer type is called on the dereferenced base.
    *ptrSlot = intPtr + 2;
    Ptr<Ptr<int>> pp = ptrSlot;
```

vs. `slang-check-expr.cpp:9461`:

```cpp
        // Members of the dereferenced base win; only when it has none do we look in the
        // pointer types that it was dereferenced through.
```

Proposed comment:

> In `checkGeneralMemberLookupExpr`, "the dereferenced base" means the fully dereferenced `**pp`. In this test comment it means the partially dereferenced `*pp`, which becomes `this`. The header uses a third phrasing, "the base at the innermost level". Using one term for the fully dereferenced base and another for the level where the member was found, consistently across the helper, the header, and the tests, would make the `pp.g()` example easier to follow.

### FG008: `maybeDereference` "appends", but consumers assume the list holds exactly this base's chain

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-impl.h:4296-4298`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-de6635fcced55ee0d7f18e86d265f8a58e13fca3b40ac0123ce0ef14306d40eaR4296
- Scope decision: Direct
- Scope rationale: New doc comment for a changed signature, consumed by a new helper.
- Overlap decision: Keep
- Overlap rationale: Not covered by another candidate.

Context:

```cpp
    /// ... Each expression that gets
    /// dereferenced is appended to `outDerefBases`, outermost first: for `pp : Ptr<Ptr<int>>`,
    /// the result is `**pp` and `outDerefBases` receives `pp` and `*pp`.
```

Proposed comment:

> The contract says levels are *appended*, which allows a non-empty list on entry. But `lookUpMemberInDerefedPtrTypes` indexes from 0 and treats index 0 as the outermost level of *this* base, for example in the `->` rule. Every caller passes a fresh list today. Either state that the list must be empty on entry (and assert it), or describe the output as "the dereferenced levels, outermost first", so the consumer's indexing assumption is part of the contract.

### FG011: `checkTupleSwizzleExpr` gains a pass-through parameter with no contract

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-impl.h:4231-4234`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-de6635fcced55ee0d7f18e86d265f8a58e13fca3b40ac0123ce0ef14306d40eaR4231
- Scope decision: Direct
- Scope rationale: The PR changed this declaration's signature.
- Overlap decision: Keep
- Overlap rationale: Same kind of request as FG015, but on a different declaration. Kept separate so each comment attaches where the change is.

Context:

```cpp
    Expr* checkTupleSwizzleExpr(
        MemberExpr* memberExpr,
        TupleType* baseTupleType,
        List<Expr*> const& derefBases);
```

Proposed comment:

> `checkTupleSwizzleExpr` has no declaration comment. The new `derefBases` parameter is used only to forward to `checkGeneralMemberLookupExpr` when the name isn't a tuple swizzle, as in `pTuple.loadGeneric()`. One line saying that non-swizzle names fall back to general member lookup with the same `derefBases` would explain why a swizzle checker needs the dereference levels.

### FG012: "pointer-like" in the new comments isn't the same set as `PointerLikeType`

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: terminology
- Location: `source/slang/slang-check-impl.h:4294-4295`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-de6635fcced55ee0d7f18e86d265f8a58e13fca3b40ac0123ce0ef14306d40eaR4294
- Scope decision: Direct
- Scope rationale: Terminology in new doc and implementation comments added by the PR.
- Overlap decision: Keep
- Overlap rationale: C003 asks for the policy rationale. This is about the vocabulary used to describe the set of types.

Context:

```cpp
    /// Implicitly dereference `inExpr` through each pointer-like type that it can be
    /// dereferenced through, ...
```

and `slang-check-expr.cpp:9429`:

```cpp
        // Only a `PtrType` has members of its own here. Other pointer-like types, such as
        // `DescriptorHandle<T>` and `ConstantBuffer<T>`, ...
```

Proposed comment:

> In the AST, `PointerLikeType` is a specific class (`DescriptorHandleType`, `ParameterGroupType`, and so on), and `PtrType`/`ExplicitRefType` are *not* subclasses of it. The new comments use lowercase "pointer-like" for the union of all three, i.e. whatever `getPointedToTypeIfCanImplicitDeref` accepts, and "other pointer-like types" implies that `PtrType` is one. The new helper's behaviour turns on exactly this distinction, so naming the set explicitly would avoid confusing it with `PointerLikeType`. For example: "every type that `getPointedToTypeIfCanImplicitDeref` dereferences".

### FG015: `checkBaseForMemberExpr` is cited as the producer of `derefBases` but has no contract for it

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-impl.h:4292`
- GitHub link: https://github.com/shader-slang/slang/pull/14317/files#diff-de6635fcced55ee0d7f18e86d265f8a58e13fca3b40ac0123ce0ef14306d40eaR4292
- Scope decision: Contextual
- Scope rationale: The missing comment predates the PR, but the PR changed the signature and added a comment elsewhere that cites this function as the source of `derefBases`.
- Overlap decision: Keep
- Overlap rationale: Same kind of request as FG011, but on a different declaration.

Context:

```cpp
    Expr* checkBaseForMemberExpr(
        Expr* baseExpr,
        CheckBaseContext checkBaseContext,
        List<Expr*>& outDerefBases);
```

Proposed comment:

> The new comment on `checkGeneralMemberLookupExpr` says `derefBases` is "as reported by `checkBaseForMemberExpr`". But `checkBaseForMemberExpr` has no declaration comment, so its contract for `outDerefBases` exists only on `maybeDereference`, two calls away. Since its signature changed here, a one-line pointer like the one added to `maybeInsertImplicitOpForMemberBase` would connect the two.

## Dropped

### FG004: `outermostLevel` names the first eligible level, not the outermost one

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Location: `source/slang/slang-check-expr.cpp:9418-9427`
- Scope decision: Direct
- Scope rationale: New code in a new helper.
- Overlap decision: Merged into C002
- Overlap rationale: C002 asks for the `->` level to be computed in one named place. The naming and off-by-one-reading points were folded into C002's comment.

Proposed comment:

> In the doc comment, "outermost" means index 0 of `derefBases`. Here `outermostLevel` instead means "the outermost level still allowed to contribute members": for `->` it is one *past* the first `PtrType`, and `getCount() + 1` when there is none. The trailing unconditional `outermostLevel++` after the `while` is easy to misread as part of the loop.

### FG005: Why `NoDeref` is required in the per-level lookup is unstated

- Status: Drop
- Confidence: Low
- Scope: Direct
- Location: `source/slang/slang-check-expr.cpp:9435-9442`
- Scope decision: Direct
- Scope rationale: New lookup call in a new helper.
- Overlap decision: Merged into C001
- Overlap rationale: The role of `NoDeref` is part of how the new loop relates to the existing breadcrumb lookup, so C001 now carries this request.

Proposed comment:

> Without `NoDeref`, `lookUpMember` on `ptrBase->type` would first search the pointee again, which already failed, and for an outer level it would re-find an inner level's member through a `Deref` breadcrumb. `NoDeref` is what makes each iteration search exactly one level.

### FG009: The `->` validity check and the `->` level rule use different predicates

- Status: Drop
- Confidence: Low
- Scope: Direct
- Location: `source/slang/slang-check-expr.cpp:9533-9534`
- Scope decision: Direct
- Scope rationale: Line rewritten by the PR.
- Overlap decision: Merged into C002
- Overlap rationale: C002 already quotes this condition and asks for one shared definition of the level `->` dereferences. The redundant `!as<PtrType>` conjunct predates the PR (`!needDeref && ...`) and isn't worth a separate comment.

Proposed comment:

> This condition treats `->` as valid whenever *any* level was implicitly dereferenced, while `lookUpMemberInDerefedPtrTypes` treats `->` as dereferencing the first `PtrType` level. Also, once `derefBases` is empty in a `Member` context, the base can't be a `PtrType`, so the third conjunct looks redundant.

### FG010: Unused `derefBases` locals give no sign that discarding them is intentional

- Status: Drop
- Confidence: Low
- Scope: Direct
- Location: `source/slang/slang-check-expr.cpp:3611`
- Scope decision: Direct
- Scope rationale: Locals added by the PR.
- Overlap decision: Duplicate of C005
- Overlap rationale: C005 makes the same request with concrete examples of the behavioural split.

Proposed comment:

> `visitIndexExpr`, `visitInvokeExpr`, and `visitStaticMemberExpr` each allocate a `derefBases` list only to satisfy the signature. If those paths deliberately don't apply the pointer-type fallback, a short note (or an overload for callers that don't need the levels) would make that visible.

### FG013: The not-found diagnostic names only the pointee after the pointer types were also searched

- Status: Drop
- Confidence: Low
- Scope: Probably out-of-scope
- Location: `tests/diagnostics/pointer-extension-member-not-found.slang:41-43`
- Scope decision: Out-of-scope
- Scope rationale: Diagnostic wording comes from the pre-existing `lookupMemberResultFailure`. This is a UX question, not a clarity problem in the changed code, and the `DescriptorHandle` aspect is already covered by C003.
- Overlap decision: Keep
- Overlap rationale: Dropped for scope rather than overlap.

Proposed comment:

> When every level fails, the diagnostic still says only "not a member of `<pointee>`", even though the pointer types were searched too. For the `DescriptorHandle` cases the user did declare `h`, just on a level that's deliberately skipped.

### FG014: `ptr-extension-this-type.slang` header no longer describes what the strict CHECK pins

- Status: Drop
- Confidence: Low
- Scope: Direct
- Location: `tests/bugs/ptr-extension-this-type.slang:26-27`
- Scope decision: Direct
- Scope rationale: Changed test lines.
- Overlap decision: Keep
- Overlap rationale: Dropped as not useful, not for overlap. The header ("doesn't segfault") is still true, and the stricter CHECK is obviously correct.

Proposed comment:

> The strict `result=1` now also checks that `p.f(other)` resolves to the `Ptr<int>` extension member (the old `CHECK: 1` could match a digit in an error message), while the header still describes only the segfault.

## Generation Coverage Audit

- `source/slang/slang-check-expr.cpp`
  - `visitIndexExpr` and `visitInvokeExpr`: list plumbing only. Covered by C005.
  - `maybeDereference` body: a one-line `add` that is obviously correct. The contract is covered by FG008 and FG012.
  - `checkTupleSwizzleExpr`: pass-through only. Covered by FG011.
  - `visitStaticMemberExpr`: covered by C005.
  - `maybeInsertImplicitOpForMemberBase`: a simplification of the old flag logic that is obviously clear.
  - `checkBaseForMemberExpr`: covered by FG015.
  - `lookUpMemberInDerefedPtrTypes`: covered by C001–C004, FG001, FG002 and FG012.
  - `checkGeneralMemberLookupExpr`: covered by FG003, FG006 and FG007.
  - `visitMemberExpr`: covered by C002.
  - Remaining call-site forwarding: obviously clear.
- `source/slang/slang-check-impl.h`: every changed declaration is covered (FG001, FG002, FG003, FG008, FG011, FG012, FG015, C004).
- `tests/diagnostics/pointer-extension-member-not-found.slang`: covered by C002 and C003. It is an exhaustive diagnostic test, so the passing `p.g()` and `pp->g()` calls are also pinned.
- `tests/language-feature/extensions/ptr-extension-instance-member.slang`: covered by C004 and FG007. The rest is clear and well commented.
- `tests/bugs/ptr-extension-this-type.slang`: FG014 was considered and dropped as obviously correct.

## Result (machine-readable)

```json
{"verdict":"REQUEST_CHANGES","bugs":1,"gaps":3,"questions":0,"diff_hash":"5758e327c9a57a14377e36f9af794abe4eb04dae62893cd6ecf17294aff09b4c","reviewers_complete":true}
```
