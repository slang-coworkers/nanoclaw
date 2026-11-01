---
type: source
description: "slang-reviewer R1 combined review of PR #14119 at ee84ee78b, 2026-10-31: REQUEST_CHANGES (small) 0 bugs/2 gaps/1 question/5 nits. Distilled into slang-14118-unbraced-body-local-visible-early.md."
okf_synth: exempt
---

# Combined PR Review — shader-slang/slang#14119 (pr, head ee84ee78b)

## Lead verdict (slang-reviewer)

# Lead verification — shader-slang/slang#14119 R1 (head ee84ee78b, base c959b561d)

slang-reviewer's own checks, run on the L40S. Every claim below comes from a run; probes are in `/workspace/agent/probes-14119/`.

## Verdict: REQUEST_CHANGES (small) — 0 bugs, 2 gaps, 1 question, 5 nits

The fix is correct for the shapes it targets, and nothing outside the PR's own tests changes. One shape that the issue lists, an unbraced `else` body, still fails when the `if` is an `if (let …)`, with the same crash on Vulkan. A small parser-side remedy is tested below.

## Maintainer direction

None on #14118 (checked live: the only comments on the issue are nv-slang-bot's). I agree with the fixer's `none`. tangent-vector's [#14099 comment](https://github.com/shader-slang/slang/issues/14099#issuecomment-6535132734) ("implement the proper scoping all developers writing code these days expect") is about the HLSL `for` scope that #14115 fixes. It is related context, not a requirement for this PR. It points toward approach B when maintainers decide B/C on #14118. Approach A does not block B.

## Findings

### G1 🟡 `if (let …) … else int i = 1;` still has the #14118 bug (Reviewer A's gap, confirmed by a run)

`parseIfLetStatement` (`slang-parser.cpp:7677`) parses `else` while its outer `ScopeDecl` is current, so an unbraced `else` local is added to that scope. The function then returns that scope as a plain `SeqStmt`. No `BlockStmt` owns the scope, so `hideLocalVarsUntilDeclared` never runs on it. Both the positive branch and the if-let initializer still bind to the `else` local:

```slang
int f(int i) { int value = 0; if (let x = makeOptional(1)) value = i; else int i = 1; return value; }
int g(int i) { int value = 0; if (let x = makeOptional(i)) value = x; else int i = 1; return value; }
```

On head, the HLSL output for both functions reads an unwritten global `i_1` / `i_0`, the same output as on base. The test rows below fail on cpu, and `slang-test` **segfaults on `-vk`** (rc 139), which is the original #14118 signature.

**Remedy, tested** (`remedy-14119-r1.patch`, 4 files, +56/−4):
- `parseIfLetStatement` returns `BlockStmt{scopeDecl = <the if-let scope>, body = newBody}`, the same way it already wraps `positiveScopeStmt`. This is a producer-side fix, so `visitBlockStmt` hides that scope with no checker change.
- The patch adds `readBeforeIfLetElseBody` and `ifLetInitializerBeforeElseBody` to `gh-14118.slang` (slots 11 and 12), and `ifLetElseBody` to the diagnostic test.
- On the remedy build, the gh-14118 tests pass 7/7 (cpu, vk, syn cuda). PR head run against the remedy's tests: diagnostic FAIL, cpu FAIL, vk segfault.
- **Cascade:** the remedy full suite gave 11135/11139. The one new failure is `tests/spirv/debug-lexical-scope-if-let.slang`, because the new `BlockStmt` adds a `DebugLexicalBlock` at the `if`: MAIN → if-let stmt → `item` block → body, where head has MAIN → `item` block → body. The patch updates that test's CHECKs (`IFLET_STMT_A/B`). With that update, `debug-lexical-scope*` + `gh-14118*` + `language-feature/optional` pass 42/42, and the updated test fails on head.
- I think the extra block is correct. It is the scope that lookup uses for an unbraced `else` local, and clang also gives `if (auto x = …)` its own lexical block. `$OptVar` gets no `DebugLocalVariable`. If maintainers do not want the block, the alternative is to skip debug emission for this wrapper in `maybeEmitDebugLexicalBlock`.

### G2 🟡 One well-defined shape changes result silently; the Risk line and the label do not say so

A `for` side-effect expression that reads the body's local behaved predictably on master, because the body runs before the side-effect on every iteration. With this PR:
- The PR's own `forSideEffectBeforeBody` returns **100 on base, 7 on head**.
- My probe, `int s = 1; for (int k = 0; k < 8; k += s, n++) int s = 2;`, gives **n = 4 on base, 8 on head**, with no diagnostic.
- With no outer `s`, master compiles and runs (n = 4). Head rejects the code with E30015.

Every other newly changed shape read an unwritten global or an uninitialized local on master; base cpu output for the PR test is `0 0 0 0 0 0 100 7 7 7 0`. The C++ result is the one head gives, so the change is right. But "Forward reads now bind outer names or error" does not tell a user that working code can change value. The fixer's self-check (4) names only the error case.
- **Ask:** add one Risk sentence naming the `for` side-effect shape and its silent rebinding.
- **For a maintainer:** CLAUDE.md defines `pr: breaking change` as code that now fails to compile. The no-outer-name variant does fail, so leave the label decision to a maintainer, as #14115 did with tangent-vector.

### Q1 🔵 `doPredicateAfterBody` pins the "leak after the statement" behavior (A's question, C001)

The reorder in `visitDoWhileStmt` keeps `do int j = n++; while (j < 6);` compiling. That is the right call while B is open. But the test comment and the `visitDoWhileStmt` comment state it as the rule. A later B fix would then look like a regression.

**Suggest:** add a single line to both comments: "Current behavior: an unbraced body has no scope of its own; #14118 option B would change this."

### Nits

- **N1** The helper's doc comment (`slang-check-stmt.cpp:95-111`) has three problems:
  - "the `hiddenFromLookup` flag rejects the forward reference" is wrong: lookup *skips* the decl and binds the outer name. The runtime tests depend on that.
  - The wording covers blocks only, but the helper is also called on `for` scopes.
  - It should state the contract: every `VarDecl` the scope owns has a `DeclStmt` that is checked within it. `$for` and `__GPU_FOREACH` variables do not, which is why the helper is not called on them.

  Also correct the stale parser comment at `slang-parser.cpp:6169-6170` ("we will mark them back as `Unchecked`"), which this PR's premise contradicts (A, C FG002).
- **N2** The `visitForStmt` comment (`:319`) is false for HLSL `UnscopedForStmt`, because the scope is never pushed and stays empty. The enclosing block's hide covers that case. Reword it to cover both forms; #14115 makes the HLSL form match (A, C C004).
- **N3** `docs/design/parsing.md:60` (hand-written, not generated) still says checking marks "all `DeclStmt`s in the block" invisible. It needs a one-sentence update to "every local the block's scope owns" (A). The generated `lookup.md`/`scopes.md` are already listed as stale in the PR body, which is fine.
- **N4** Test wording and order. The `gh-14118.slang` header says "code that runs before"; the rule is source order (C FG004). Also, `whilePredicateBeforeBody` writes slot 10, after the controls (C FG005).
- **N5** Bonus fix, not disclosed: a forward read before `defer int i = 1;` read an unwritten global on base and reads the parameter on head (`probes-14119/p-defer.slang`). Optionally add a row and mention it.

### Refuted

- **Devin flag "CUDA coverage claim lacks a test directive"** (C made the same point): refuted. slang-test synthesizes a CUDA row from the `-cpu` line, and on head `gh-14118.slang.2 syn (cuda)` and `gh-14118-hlsl-for.hlsl.2 syn (cuda)` both pass. The description is accurate.
- **A: `__target_switch` case scopes:** these predate this PR. The fixer reported them as a follow-up, and they are out of #14118's list. Head matches base (`probes-14119/p-tswitch.slang` reads global `w_0` on both).

## Verification

- **New tests:** 7/7 on head (cpu, vk, syn cuda). On base, the diagnostic and HLSL-cpu tests fail and vk segfaults.
- **Full suite on head:** 11136/11139. The 3 failures are the known `fp8-cuda*` tests.
- **`slang-static-unit-test`** (`-DSLANG_LIB_TYPE=STATIC` build): 61 passed, 0 failed.
- **New-hide drill:** an instrumented head build logs every lookup the new rule changes (a decl hidden only by the new rule, not by the old direct-child rule). Across the full suite, it fires only in the PR's own 3 tests (16 sites). In `docs/generated/tests` it fires 0 times; that suite passes 6554/6582 on both drill head and base, with an identical failing set. So no existing test silently changes binding.
- **HLSL corpus drill:** 253 DXC test files through `slangc -lang hlsl -no-codegen`, base vs head. 15 files differ, and all 15 have *fewer* E39999 "ambiguous reference" cascades (sibling-`for` files). No new diagnostic appears anywhere.
- **Probes** (`p-fnlevel.slang`; all read 7 on head and fail on base):
  - function-body-level shadowing
  - a `DeclGroup` body (`int a = 1, i = 2;`)
  - nested `if (c) if (c)`
  - `else if`
  - a `switch` case
  - `for { if }`
  - if-let positive branch
  - `let` body
- **Unaffected probes:** a local `cbuffer` in a block compiles the same on both. A braced `do` body's local is still invisible to the predicate (E30015 on both).
- **#14115 interplay:** `git merge-tree` with #14115's head 42f8ba6d0 is clean, and the two PRs touch no common file. After #14115 lands, the `gh-14118-hlsl-for.hlsl` header ("belongs to the enclosing block") becomes stale. The test still passes, because the init var moves to the `for` scope and `visitForStmt` hides it.

The tested remedy patch is attached separately as `remedy-14119-r1.patch` (`git apply` on ee84ee78b).

## Reviewer A — Correctness (nv-slang-bot)

I've checked the claims against the source: the `if (let …) … else int i = …;` leak and the HLSL `for` comment mismatch are both confirmed. Now I'm writing the final review.

**Editorial table (Step 3)**

| Source agent | file:line | Severity | Confidence | Evidence / verification quote | User-visible impact | Keep / Drop |
|---|---|---|---|---|---|---|
| test-coverage, clarity C001 | `slang-check-stmt.cpp:113` (parser 7677–7770) | 🟡 Gap | 88 | `pushScopeAndSetParent(scopeDecl);` … `PopScope();` (positive) … `ifStatement->negativeStatement = ParseStatement(ifStatement);`. Verification: `pushScopeAndSetParent` only does `containerDecl->parentDecl = currentScope->containerDecl; PushScope(containerDecl);`, so it is not a member of the block | `if (let x = o) value = i; else int i = 1;` binds `i` to the else-branch local | Keep |
| code-quality #2, ir-correctness #2 | parser `6970` (`__target_switch`) | 🟡 Gap | 80 (override) | `ScopeDecl* scopeDecl = parser->astBuilder->create<ScopeDecl>(); parser->pushScopeAndSetParent(scopeDecl);`; `class TargetCaseStmt : public ChildStmt` | Forward reference inside a case is accepted | Keep (bundled into the if-let comment) |
| ir-correctness #1, code-quality #1/#5, clarity C002 | `slang-check-stmt.cpp:309`, `gh-14118.slang:105` | 🔵 Question | 85 (override) | `subContext.checkStmt(stmt->statement);` / `stmt->predicate = checkPredicateExpr(...)`; test comment "the predicate of a `do` loop follows its body, so the predicate sees that local". Verification: the braced form gets its own scope via `parseBlockStatement` → `pushScopeAndSetParent(scopeDecl)` (parser 7535) | Locks in unbraced-body locals leaking to the predicate and later statements | Keep |
| clarity FG001/FG002/C004 | `slang-check-stmt.cpp:107` | Clarity | — | "the `hiddenFromLookup` flag rejects the forward reference"; `_isUncheckedLocalVar` skips the member; parser 6169 "we will mark them back as `Unchecked`" | Doc comment misdescribes the mechanism and contradicts the parser comment | Keep (clarity) |
| clarity FG003/FG004, code-quality #4 | `slang-check-stmt.cpp:319` | Clarity | 70+ | `if (!brokenScoping) pushScopeAndSetParent(scopeDecl);` | Comment is false for HLSL `UnscopedForStmt` | Keep (clarity) |
| clarity C003, code-quality #3 | `slang-check-stmt.cpp:139` (`docs/design/parsing.md:60`) | Clarity / doc Gap | 80 | "we will first visit all `DeclStmt`s in the block, mark it as `invisible`" | Design doc describes the removed loop | Keep (clarity) |
| clarity FG007/FG008 | `gh-14118.slang:1`, `:157` | Clarity | — | "invisible to code that runs before its declaration" | Test header states the rule in terms of execution order | Keep (clarity, bundled) |
| test-coverage #2 | `gh-14118-hlsl-for.hlsl:10` | 🟡 Gap | 60 | Only `readBeforeForInit` | Uses the same block-level mechanism the existing HLSL test already covers | Drop (folded into the `:319` comment as a suggestion) |
| security | — | — | — | No findings; `visitBlockStmt` call is inside `if (stmt->scopeDecl)`, and both `ForStmt` producers set `scopeDecl` | — | n/a |

---

**Verdict**: 🔴 Has issues — 0 bugs, 1 gap, 1 question (plus 4 clarity comments)

This PR changes `visitBlockStmt`/`visitForStmt` to hide every `VarDecl` owned by the statement's `ScopeDecl` until its `DeclStmt` is checked, and moves `do`/`while` checking to body-before-predicate. Scopes that no `BlockStmt`/`ForStmt` owns are still not hidden, so an unbraced `else` body of `if (let …)` keeps the #14118 behavior. The new `do`-predicate test also locks in unbraced-body locals leaking out of their statement, which needs an explicit decision.

<details>
<summary>Changes Overview</summary>

**Local visibility during checking** (`source/slang/slang-check-stmt.cpp`)
- What changed: the inline loop that hid only the direct-child `DeclStmt`s of a block's `SeqStmt` is replaced by `hideLocalVarsUntilDeclared(ScopeDecl*)`. That helper hides every `VarDecl` member of the scope, which covers locals declared in unbraced `if`/`else`/`while`/`do` bodies, after labels, and HLSL `for` initializers. It is called from `visitBlockStmt` and at the start of `visitForStmt`.
- `visitDoWhileStmt` now checks the body before the predicate, so a predicate that refers to an unbraced body's local still resolves.

**Regression tests** (`tests/bugs/gh-14118.slang`, `tests/bugs/gh-14118-diagnostic.slang`, `tests/bugs/gh-14118-hlsl-for.hlsl`)
- What changed: CPU/VK runtime tests for reads that come before an unbraced-body or labeled declaration, `for` predicate/side-effect and `while` predicate cases, a `do`-predicate-sees-body case, and braced/direct controls. Also a diagnostic test for undefined forward references, and an HLSL `for`-initializer test that exercises `UnscopedForStmt`.

</details>

<details>
<summary>Findings (6 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 🟡 Gap | `source/slang/slang-check-stmt.cpp:113` | Unbraced `else` body of `if (let …)` (and `__target_switch` case scopes) is still visible to earlier code: no `BlockStmt`/`ForStmt` owns that scope, and there is no test |
| 🔵 Question | `source/slang/slang-check-stmt.cpp:309` | Do-while reorder and `doPredicateAfterBody` make "an unbraced body's local leaks into the enclosing scope" a tested guarantee: intended semantics or a parser artifact? |
| Clarity | `source/slang/slang-check-stmt.cpp:107` | Helper doc says the flag "rejects" the reference (lookup skips it), is phrased for blocks only, and contradicts the parser comment about `ReadyForParserLookup` |
| Clarity | `source/slang/slang-check-stmt.cpp:319` | `for` comment is false for HLSL `UnscopedForStmt`; `scopeDecl` non-null contract is implicit |
| Clarity | `source/slang/slang-check-stmt.cpp:139` | `docs/design/parsing.md` still describes the removed direct-`DeclStmt` loop; the source-order checking contract is undocumented |
| Clarity | `tests/bugs/gh-14118.slang:1` | Header states the rule as execution order; output slot order doesn't follow function order |

</details>

<sub>reviewed: ee84ee78bbfa1bcc76a344ec7b0fb8f847865fdd · diff sha256 fe6020b423a1</sub>

---

### `source/slang/slang-check-stmt.cpp:113`

🟡 **Gap**: An unbraced `else` body of `if (let …)` is still visible to earlier code, because no `BlockStmt` or `ForStmt` owns its scope

`hideLocalVarsUntilDeclared` only runs on scopes reachable as `BlockStmt::scopeDecl` or `ForStmt::scopeDecl`. `Parser::parseIfLetStatement` (`slang-parser.cpp:7677-7770`) pushes an outer `ScopeDecl` and pops the positive scope before it parses `else`. So an unbraced `else` declaration is added to that outer scope: `ifStatement->negativeStatement = ParseStatement(ifStatement);` runs with it as `currentScope`. The result is returned in a plain `SeqStmt`, and `pushScopeAndSetParent` only sets `parentDecl` (`containerDecl->parentDecl = currentScope->containerDecl; PushScope(containerDecl);`), so that scope is never a member of the enclosing block either. Nothing hides the `else` local. `visitIfStmt` checks `positiveStatement` before `negativeStatement`. Lookup from the positive branch goes `positiveScopeDecl` → if-let `ScopeDecl` and finds the `else` local, which is `ReadyForParserLookup` with `hiddenFromLookup == false`. The if-let initializer is parsed in the same scope and has the same problem. #14118 explicitly covers unbraced `else` bodies.

**Example**:
```slang
int f(int i, Optional<int> o)
{
    int value = 0;
    if (let x = o)
        value = i;      // expected: parameter `i`; actual: the else-branch `i`
    else
        int i = 1;
    return value;
}
```

The same class of leak predates this PR in `__target_switch`/`__stage_switch` cases. `parseTargetSwitchStmtImpl` creates a `ScopeDecl` per case group (`slang-parser.cpp:6970-6971`), but `TargetCaseStmt` is a `ChildStmt`, so `__target_switch { default: int v = w; int w = 1; }` still accepts `w`.

**Suggestion**: Make every parser scope that can own locals reachable by the hide step. For example, wrap the if-let's outer `SeqStmt` (and each target-switch case body) in a `BlockStmt` whose `scopeDecl` is the pushed `ScopeDecl`, the way `positiveScopeStmt` already does for the positive branch. Then `visitBlockStmt` covers them with no further checker changes. Add an `if (let …) … else int i = …;` case to `gh-14118.slang` and `gh-14118-diagnostic.slang`.

### `source/slang/slang-check-stmt.cpp:309`

🔵 **Question**: Is "an unbraced body's local stays visible after its statement" intended Slang semantics, or a parser artifact the reorder preserves?

The reorder exists only so that `do int j = n++; while (j < 6);` keeps compiling under the new hiding. `doPredicateAfterBody` in `tests/bugs/gh-14118.slang:98-106` now asserts that behavior, with the comment "An unbraced body's local belongs to the enclosing scope … so the predicate sees that local". The braced form behaves differently: `do { int j = n++; } while (j < 6);` does not see `j`, because `parseBlockStatement` gives the body its own scope (`pushScopeAndSetParent(scopeDecl)`, `slang-parser.cpp:7535`). C++ [stmt.iter] also treats a non-compound loop substatement as if it were wrapped in braces. The same leak lets `if (c) int x = 1; return x;` bind `x` to the inner local after this PR. The PR body notes that unbraced bodies "still create nested block-scope locals", but the test and the `visitDoWhileStmt` comment present this as the specified rule.

The decision needed: **(a)** this is intended Slang scoping, in which case a sentence in the comment/test should say so, and ideally the user guide or `docs/design/parsing.md`; or **(b)** it is a parser artifact, in which case `doPredicateAfterBody` should not assert it. Either drop that case or add a TODO pointing to the follow-up issue, so the eventual fix (giving unbraced bodies their own scope in `parseIfStatement`/`ParseWhileStatement`/`ParseDoStatement`/`ParseForStatement`) doesn't look like a regression.

Separately, the new comment says "lookup reveals a local only once checking reaches its declaration". Lookup never reveals anything: `checkDeclAtDeclarationPoint` clears `hiddenFromLookup` when the `DeclStmt` is checked. Using the same hide/reveal wording as `hideLocalVarsUntilDeclared` would make the two comments read as one mechanism.

### `source/slang/slang-check-stmt.cpp:107`

**Clarity**: The helper's doc comment misdescribes the mechanism and contradicts the parser's comment

- "the `hiddenFromLookup` flag rejects the forward reference" is not what the flag does. `_isUncheckedLocalVar` (`slang-lookup.cpp:174-180`) makes `_lookUpDirectAndTransparentMembers` *skip* the member, so the name resolves outward. It is undefined only when nothing outer matches. The runtime tests depend on that: `readBeforeIfBody` expects `value = i` to bind to the parameter. The example's `// should error.` holds only because there is no outer `b`.
- The rationale is written for blocks only ("adds `b` to the block's scope", "rather than only those declared by the block's direct statements"), but the helper is also called on `for` scopes. The second clause also contrasts with the code this PR deletes. Stating the rule in scope-neutral terms would make it hold for every caller: `parseVarDeclrStatement` adds to `currentScope->containerDecl`, the innermost parser scope, whatever statement it is nested in.
- The claim "Body-stage parsing leaves every local in the `ReadyForParserLookup` state" matches the code. But it contradicts the comment where the state is set, `slang-parser.cpp:6169-6170`: "Before checking the decl in semantic checking, we will mark them back as `Unchecked`." This PR's correctness argument now rests on that state *not* being reset, so the parser comment should be corrected to match.

### `source/slang/slang-check-stmt.cpp:319`

**Clarity**: The `for` comment is false for HLSL `UnscopedForStmt`, and the non-null `scopeDecl` contract is implicit

The comment says "The loop's scope owns both the variables of its initial statement and a declaration used as an unbraced body". `ParseForStatement` only pushes the scope when `!brokenScoping` (`if (!brokenScoping) pushScopeAndSetParent(scopeDecl);`, `slang-parser.cpp:7819-7820`). For HLSL that scope is always empty, the initializer and body locals land in the enclosing block, and this call does nothing. The HLSL case is handled by the `visitBlockStmt` call, which a reader trusting this comment won't look for. "a declaration used as an unbraced body" is also narrower than what the scope owns, which includes any unbraced-nested local such as `for (...) if (c) int x = 1;`.

`visitBlockStmt` also guards with `if (stmt->scopeDecl)`, while this call passes `stmt->scopeDecl` unconditionally and the helper dereferences it. Both `ForStmt` producers (`ParseForStatement`, `ASTSynthesizer::emitFor`) set it, so this is safe today. A `SLANG_ASSERT(scopeDecl)` in the helper would make the contract explicit, per CLAUDE.md "Fail loudly on out-of-contract input".

**Suggestion**: Describe both loop forms in the comment. Consider an HLSL case like `for (int k = 0; k < i; k++) int i = 100;` in `gh-14118-hlsl-for.hlsl` to pin the block-level path for `UnscopedForStmt`.

### `source/slang/slang-check-stmt.cpp:139`

**Clarity**: `docs/design/parsing.md` still describes the removed loop, and the checking-order contract the fix relies on is not written down

`docs/design/parsing.md:60` says that before checking a `BlockStmt` "we will first visit all `DeclStmt`s in the block, mark it as `invisible`". That is the logic this line replaces. The new rule hides every `VarDecl` the scope owns, and it now also runs for `for` scopes.

The PR also makes name binding depend on visitor ordering. Three things have to hold:
1. The hide must run on scope entry, before anything whose lookups go through that scope; a late call would re-hide revealed locals.
2. Each statement visitor must check its parts in source order. The `visitDoWhileStmt` reorder is an instance of this.
3. A local whose `DeclStmt` is never checked stays hidden.

A future visitor that checks a part early would silently change which declaration a name binds to, rather than produce a diagnostic.

**Suggestion**: Update that section of `parsing.md` to describe scope-level hiding and the source-order contract, and have the helper's doc comment point to it.

### `tests/bugs/gh-14118.slang:1`

**Clarity**: The test header states the rule as execution order, and output order doesn't follow function order

- "it must stay invisible to code that runs before its declaration" describes execution order. The rule under test is source/checking order, and this file shows the two differ: in `forSideEffectBeforeBody`, `value = i` *runs* after the body on every iteration but must still bind to the parameter. Later comments in the file say "checked before". The header should use the same terms.
- `whilePredicateBeforeBody` is defined between `forSideEffectBeforeBody` and `doPredicateAfterBody`, but it writes `outputBuffer[10]` (line 157), after the two "Controls". Renumbering so that function order matches slot order would make it easier to pair each function with its `CHECK-NEXT`.

## Reviewer B — Devin Review

# Devin Review

## AI Analysis

Locals declared as unbraced statement bodies now stay hidden until their declaration point. Forward reads of such names bind outer declarations or fail with an undefined-identifier error.

Add hideLocalVarsUntilDeclared, which hides every local a scope owns, and call it from block and for checking.
Check for and do predicates in source order so they see the body's locals only when correct.
Cover the behavior with runtime, diagnostic, and HLSL for tests.
Show less

Summary. A local declared as an unbraced if/else/while/do/for body or after a label was visible to earlier code (value = i; if (c) int i = 1; read an unwritten global). We now hide every local a block or for scope owns until its declaration. Root cause. visitBlockStmt (slang-check-stmt.cpp:128) hid only direct-child DeclStmts; body-stage locals stay ReadyForParserLookup, so nothing else hid nested ones. Tests. New cpu/vk/cuda, diagnostic and HLSL for tests; full and generated suites: no new failures (3 fp8 CUDA fail, as on master). Now stale: docs/generated/design/name-resolution/lookup.md, scopes.md. Risk. Forward reads now bind outer names or error. B and C stay open on #14118. Separate from #14115 (removes UnscopedForStmt); unbraced bodies and labels still nest locals. Not covered: __target_switch cases; unbraced catch/$for declaration groups. Hiding every scope is unsafe: $for/GPU-foreach loop vars have no DeclStmt.

Fixes #14118

🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.

Show less
320 lines left
1
Add hideLocalVarsUntilDeclared and use it for blocks
0/1
slang-check-stmt.cpp
source/slang
(1 of 3)
+26
−33
Viewed
All 57 lines
5 lines
58
void SemanticsStmtVisitor::visitDeclStmt(DeclStmt* stmt)
59
{
60
    if (auto declGroup = as<DeclGroup>(stmt->decl))
61
    {
62
        // The members of a group reach their declaration points in order, so
63
        // that a later initializer can refer to an earlier member, as in
64
        // `int a = 1, b = a;`.
65
        for (auto decl : declGroup->decls)
66
            checkDeclAtDeclarationPoint(decl);
67
        return;
68
    }
69
 
70
    auto decl = as<Decl>(stmt->decl);
71
    SLANG_RELEASE_ASSERT(decl);
72
    checkDeclAtDeclarationPoint(decl);
73
}
74
 
75
void SemanticsStmtVisitor::checkDeclAtDeclarationPoint(Decl* decl)
76
{
77
    // When we encounter a declaration during statement checking,
78
    // it may already be partly checked, for example by a parser-time
79
    // lookup that decides what `a <` means, so we bottleneck through
80
    // the `ensureDecl()` path to unify with the rest of semantic checking.
81
    //
82
    // TODO: This logic might not suffice for something like a
83
    // local `struct` declaration, where it would have members
84
    // that need to be recursively checked.
85
    //
86
    ensureDecl(decl, DeclCheckState::DefinitionChecked, this);
87
    decl->hiddenFromLookup = false;
88
    if (auto varDecl = as<VarDeclBase>(decl))
89
    {
90
        if (varDecl->initExpr)
91
            varDecl->initExpr = maybeRegisterLambdaCapture(varDecl->initExpr);
92
    }
93
}
94
 
95
/// Hide every local variable that `scopeDecl` owns from lookup until checking reaches its
96
/// declaration point, where `checkDeclAtDeclarationPoint` reveals it.
97
///
98
/// Consider this example:
99
/// ```
100
/// {
101
///     int a = 5 + b; // should error.
102
///     if (c)
103
///         int b = 3;
104
/// }
105
/// ```
106
/// Body-stage parsing leaves every local in the `ReadyForParserLookup` state, so the check
107
/// state alone does not make lookup skip `b`; the `hiddenFromLookup` flag rejects the forward
108
/// reference (see `_isUncheckedLocalVar`). The parser gives an unbraced statement body no scope
109
/// of its own and adds `b` to the block's scope although its `DeclStmt` is nested in the `if`,
110
/// so we hide every variable the scope owns rather than only those declared by the block's
111
/// direct statements.
112
///
113
static void hideLocalVarsUntilDeclared(ScopeDecl* scopeDecl)
114
{
115
    for (auto varDecl : scopeDecl->getDirectMemberDeclsOfType<VarDecl>())
116
        varDecl->hiddenFromLookup = true;
117
}
118
 
119
 
120
void SemanticsStmtVisitor::visitBlockStmt(BlockStmt* stmt)
121
{
122
    // Make sure to fully check all nested agg type decls first.
123
    if (stmt->scopeDecl)
124
    {
5 lines
All 12 lines
5 lines
137
        }
138
 
114
        // Consider this code:
115
        // ```
116
        // {
117
        //       int a = 5 + b; // should error.
118
        //       int b = 3;
119
        // }
120
        //
121
        // ```
122
        // In order to detect the error trying to use `b` before it's declared within
123
        // a block, our lookup logic contains a condition that ignores a decl if its
124
        // `hiddenFromLookup` field is set to `true`.
125
        // See _lookUpDirectAndTransparentMembers().
126
        // This field will be set to false when we reach the decl 

## Vulnerabilities

(none reported)

## Bugs

(none reported)

## Flags

CUDA coverage claim lacks a test directive
Investigate
gh-14118.slang:5-6

## Informational

(none reported)

## Reviewer C — Clarity

The clarity pipeline ran end-to-end on PR #14119, and nothing was posted to GitHub. I didn't build the PR branch, so the `if (let ...)` hole in C003 comes from reading the parser and checker code and hasn't been run. Eight candidates are postable and three are kept in the Dropped section for audit. The canonical file is `tmp/review-candidates/pr-14119-clarity-workflow.md`; its full contents follow.

# PR 14119 Clarity Workflow Candidates

## PR Summary

- **PR:** shader-slang/slang#14119, "Hide a local declared as an unbraced statement body until its declaration". Head: `ee84ee78bbfa1bcc76a344ec7b0fb8f847865fdd`. Size: +286/-34. Fixes #14118.
- **What the description says:** A local declared as an unbraced `if`/`else`/`while`/`do`/`for` body, or after a label, was visible to earlier code. As a result, `value = i; if (c) int i = 1;` read an unwritten local. The fix hides every local that a block or `for` scope owns until its declaration. The root cause given is that `visitBlockStmt` hid only `DeclStmt`s that were direct children.
- **What the diff does:**
  - `slang-check-stmt.cpp` adds a static helper, `hideLocalVarsUntilDeclared(ScopeDecl*)`. It sets `hiddenFromLookup` on every `VarDecl` directly owned by a scope, and it has a worked-example doc comment.
  - The helper replaces the `SeqStmt`/`DeclStmt` scan in `visitBlockStmt`, and it is newly called at the top of `visitForStmt`.
  - `visitDoWhileStmt` now checks the body before the predicate.
  - Three tests are added: a CPU/VK runtime test of every nesting shape plus controls, a diagnostic test, and an HLSL `for`-init runtime test.
- **Mismatches between the description and the diff:**
  - The description never mentions the `do`/`while` check-order change. That change is a necessary cascade: without it, `doPredicateAfterBody` would fail with "undefined identifier".
  - The description claims runtime tests on "cpu/vk/cuda", but the new tests have only `-cpu` and `-vk` directives.
  - The description is not in the five-part format that `CLAUDE.md` requires. It does not answer the input-shape question: is the parser's placement of unbraced-body locals in the enclosing scope canonical, or should the parser be fixed?
- **Apparent value:** The PR fixes a silent miscompile, a forward reference binding to a later, uninitialized local, with a small checker change. The change also simplifies the rule from "direct statement children" to "scope ownership".

## Review Body

> Claude Opus 5.5-authored clarity review:
>
> This is a small, well-targeted fix for a silent miscompile. A forward reference such as `value = i; if (c) int i = 1;` used to bind to the later, uninitialized local. Replacing the direct-child `DeclStmt` scan in `visitBlockStmt` with hiding by scope ownership is a simpler rule than the one it replaces. The new helper has a real doc comment with a worked example, and the runtime and diagnostic tests cover each nesting shape with controls. On the code side this is close to merge-ready. Most of my comments ask you to make the scoping model explicit, not to change the mechanism.
>
> ## Main Concerns
>
> - **Which scoping rule does this lock in?** The `do`/`while` reorder and the `doPredicateAfterBody` test commit to an unbraced body's local being visible after the statement. C++ does not allow this, and the helper's own comment describes the same placement as a parser artifact. Please say whether this is intended Slang semantics or provisional behavior tied to #14118 and #14115.
> - **Completeness of the case analysis.** Hiding is applied only to `BlockStmt` and `ForStmt` scopes. The `else` branch of `if (let ...)` appears to leave the same forward-reference hole open, and the code does not say why the other scope owners are safe.
> - **Unstated invariants.** The hide-then-reveal scheme now relies on two properties: every owned local is later revealed by a `DeclStmt`, and statement checking runs in source order. The helper's contract should say so.
> - **Comment accuracy.** The `visitForStmt` comment is wrong for HLSL's `UnscopedForStmt`. The new doc comment contradicts a stale parser comment about `ReadyForParserLookup`. The test comments describe lexical visibility in terms of run order and checker order.
>
> ## PR Description
>
> The description does not mention the `do`/`while` reorder, which is a necessary consequence of the broader hiding. It says the runtime tests cover cuda, but the new tests only have `-cpu` and `-vk` directives. It also does not follow the five-part format in `CLAUDE.md`. Following that format would naturally answer the input-shape question: should the parser's placement of unbraced-body locals in the enclosing scope be fixed instead?

## Kept

### C001: Is "an unbraced body's local belongs to the enclosing scope" a language rule or a parser artifact?

- Status: Keep
- Confidence: High
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-stmt.cpp:305-309`
- GitHub link: https://github.com/shader-slang/slang/pull/14119/files#diff-b92ce6a8de0f3f3208b7ea596996194853be20445e43a397fbbe75d8e103b87cR305
- Overlap decision: Keep
- Overlap rationale: This is the only candidate about the semantic status of the scope placement and the `do`/`while` reorder. FG004 touches nearby test comments but asks about a different issue (lexical versus dynamic wording).
- Scope decision: Direct
- Scope rationale: The reorder, its comment, and the `doPredicateAfterBody` test that pins down the behavior are all added by this PR.

Context:

```cpp
    // We check the body before the predicate, in source order, because lookup reveals a
    // local only once checking reaches its declaration: the predicate of
    // `do int i = next(); while (i != 0);` refers to the `i` that the body declares.
    subContext.checkStmt(stmt->statement);
    stmt->predicate = checkPredicateExpr(stmt->predicate);
```

```slang
// tests/bugs/gh-14118.slang:98-107
// An unbraced body's local belongs to the enclosing scope, and the predicate of
// a `do` loop follows its body, so the predicate sees that local.
int doPredicateAfterBody()
{
    int n = 0;
    do
        int j = n++;
    while (j < 6);
    return n;
}
```

Proposed comment:

> The PR describes the scope placement of an unbraced body's local in two different ways. The helper's doc comment presents it as parser behavior ("The parser gives an unbraced statement body no scope of its own"). This comment and the `doPredicateAfterBody` test present it as the language rule ("An unbraced body's local belongs to the enclosing scope ... so the predicate sees that local"). A reviewer needs to know which one is meant, because the answer decides whether this fix is at the right layer:
>
> - If it is intended Slang semantics, the reorder and the test pin down deliberate behavior, and a comment or doc reference should say so. This behavior differs from C++, which gives a substatement its own scope, so there `j` is not visible in the predicate of `do int j = n++; while (j < 6);`.
> - If it is a parser artifact, then the reorder exists to keep an accidental shape working. The PR description says some cases "remain open on #14118" and that #14115 is changing nearby scoping. In that case `doPredicateAfterBody` will look like a regression to whoever later gives unbraced bodies their own scope.
>
> Could the comments and the test say which it is, and if the behavior is provisional, point at the tracking issue?

Notes:
The `do`/`while` reorder is a cascade from the broader hiding. Without it, `j` would be hidden when the predicate is checked, and `doPredicateAfterBody` would fail with "undefined identifier". CLAUDE.md's input-shape rule applies directly here. The PR body does not mention the reorder.

### C002: The hide-then-reveal scheme depends on unstated invariants

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: invariant
- Location: `source/slang/slang-check-stmt.cpp:95-116`
- GitHub link: https://github.com/shader-slang/slang/pull/14119/files#diff-b92ce6a8de0f3f3208b7ea596996194853be20445e43a397fbbe75d8e103b87cR95
- Overlap decision: Keep
- Overlap rationale: This asks for the helper's contract (what must be true for hiding to be correct). FG001 asks about the rationale paragraph's list of shapes, and C003 asks which scope owners need hiding. They are related but distinct requests. FG007 was folded in as superseded.
- Scope decision: Direct
- Scope rationale: The helper and its doc comment are new in this PR, and the PR broadens what is hidden without broadening what is revealed.
- Judgment decision: Revise
- Judgment rationale: The first draft gave function-local unscoped-enum aliases as an owned `VarDecl` with no `DeclStmt`. Follow-up reading showed that local `enum`s go through the type-specifier path and that those aliases are `Unchecked` anyway, so the example was replaced with verified ones: the `$for` loop variable (`parseCompileTimeForStmt`) and the `__GPU_FOREACH` `dispatchThreadID` (`ParseGpuForeachStmt`).

Context:

```cpp
/// Hide every local variable that `scopeDecl` owns from lookup until checking reaches its
/// declaration point, where `checkDeclAtDeclarationPoint` reveals it.
...
static void hideLocalVarsUntilDeclared(ScopeDecl* scopeDecl)
{
    for (auto varDecl : scopeDecl->getDirectMemberDeclsOfType<VarDecl>())
        varDecl->hiddenFromLookup = true;
}
```

Proposed comment:

> The old code hid exactly the declarations whose `DeclStmt`s it could see, so everything it hid was revealed by construction. This helper hides every `VarDecl` the scope owns. It produces correct lexical scoping only if two properties hold, and neither is stated:
>
> 1. Every `VarDecl` the scope owns has a `DeclStmt` that checking this statement reaches. Otherwise the variable stays hidden for the rest of the function. Some locals have no `DeclStmt`, such as the `$for` loop variable and `__GPU_FOREACH`'s `dispatchThreadID`. They are safe today only because they live in scopes this helper is never called on.
> 2. Statement checking visits the uses and declarations in a scope in source order. The `do`/`while` change in this PR fixes a visitor that broke this property, so the property is load-bearing.
>
> Could the doc comment state the contract the helper relies on, so that someone who adds a statement kind or a parser-synthesized local knows what to preserve? Asserting it after the block is checked would also work.

Notes:
`parseCompileTimeForStmt` (`slang-parser.cpp:7232-7258`) and `ParseGpuForeachStmt` (`slang-parser.cpp:7109-7119`) each `AddMember` a `VarDecl` into their own `ScopeDecl` without a `DeclStmt`. `visitCompileTimeForStmt` sets the check state directly, and `visitGpuForeachStmt` calls `ensureDeclBase`. Neither touches `hiddenFromLookup`. This is not a bug today, but it shows that the invariant is not structural.

### C003: Which scope owners need hiding, and why only `BlockStmt` and `ForStmt`?

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: correctness smell
- Location: `source/slang/slang-check-stmt.cpp:139`
- GitHub link: https://github.com/shader-slang/slang/pull/14119/files#diff-b92ce6a8de0f3f3208b7ea596996194853be20445e43a397fbbe75d8e103b87cR139
- Overlap decision: Keep
- Overlap rationale: This is about coverage of scope owners and a concrete residual case. It is distinct from C002 (the helper's invariants) and from C004 (accuracy of the `for` comment).
- Scope decision: Direct
- Scope rationale: The PR defines the fix as "every local a block or `for` scope owns". Whether that is the complete set of scope owners is part of the PR's own correctness argument.
- Judgment decision: Revise
- Judgment rationale: The draft was anchored on the `visitForStmt` call, which collided with C004. It is moved to the `visitBlockStmt` call. The `if (let ...)` trace was re-verified through `parseIfLetStatement` and `parseVarDeclrStatement`, and the wording is hedged because the PR branch was not built.

Context:

```cpp
        hideLocalVarsUntilDeclared(stmt->scopeDecl);
    }
    checkStmt(stmt->body);
```

Proposed comment:

> This call and the one in `visitForStmt` apply hiding to two scope owners, `BlockStmt` and `ForStmt`. Other statements also own a `ScopeDecl` that an unbraced body's local can land in: `CompileTimeForStmt`, `CatchStmt`, and the synthesized scopes of `if (let ...)`. The code does not say why those are safe. The rule seems to be: a scope needs hiding when code inside that scope is checked before a local the scope owns.
>
> - For `$for` and `catch`, only the loop or error variable precedes the body inside the scope, so no forward reference is possible.
> - For `if (let x = e) use(z); else int z = 1;`, `parseIfLetStatement` parses the `else` statement while its outer `ScopeDecl` is current, so `z` is added there. No `BlockStmt` owns that scope. The positive branch is checked first and its lookup goes through that scope, so as far as I can tell `use(z)` still binds to the `else` branch's `z`.
>
> Could you either cover the `if (let ...)` case or state the rule and explain why the remaining scope owners do not need hiding? Otherwise a reader cannot tell whether "every local a block or `for` scope owns" is the complete fix or a partial one.

Notes:
Here is the trace. `parseIfLetStatement` (`slang-parser.cpp:7677-7771`) pushes the outer `scopeDecl`, then pushes `positiveScopeDecl`, parses the positive statement, and pops it. It then parses `else` with the outer scope current. `parseVarDeclrStatement` adds `z` to `currentScope->containerDecl`, and body-stage parsing leaves it as `ReadyForParserLookup`. The outer scope is attached to a `SeqStmt`, not to a `BlockStmt`, so nothing hides it. This was not verified at runtime. The PR body's "B and C remain open on #14118" may already cover it, but the code does not say so.

### C004: The `for` comment is wrong for HLSL's `UnscopedForStmt` and hard to parse

- Status: Revise
- Confidence: High
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-stmt.cpp:319-322`
- GitHub link: https://github.com/shader-slang/slang/pull/14119/files#diff-b92ce6a8de0f3f3208b7ea596996194853be20445e43a397fbbe75d8e103b87cR319
- Overlap decision: Keep
- Overlap rationale: FG003 asked about the wording of the same three-line comment and was merged here, so the author gets one comment on one comment block.
- Scope decision: Direct
- Scope rationale: The comment and the call are added by this PR.

Context:

```cpp
    // The loop's scope owns both the variables of its initial statement and a declaration
    // used as an unbraced body, as in `for (int k = 0; k < i; k++) int i = 1;`. The predicate
    // and side-effect expressions are checked before the body and must not see the latter.
    hideLocalVarsUntilDeclared(stmt->scopeDecl);
```

Proposed comment:

> `visitForStmt` also handles HLSL's `UnscopedForStmt`. For that statement, `ParseForStatement` creates `stmt->scopeDecl` but never pushes it. The scope stays empty, and this call does nothing. The initial-statement variables and any unbraced-body local belong to the enclosing block. `gh-14118-hlsl-for.hlsl` passes because `visitBlockStmt` hides them, not because of this call. The comment says unconditionally that "the loop's scope owns" those declarations, which is only true for Slang's scoped `for`.
>
> The last sentence is also hard to parse. "The latter" points back across a sentence and an inline example, and the sentence merges the requirement with the mechanism. The predicate and side-effect expressions must not see the body's local because they come before its declaration in source. The hiding is needed because they are also checked before the body's `DeclStmt` reveals it. Could the comment cover both scoping modes and separate the rule from the reason for the call?

Notes:
In `slang-parser.cpp:7801-7820`, `brokenScoping` skips `pushScopeAndSetParent(scopeDecl)`. The PR body says that #14115 removes `UnscopedForStmt`. Until it lands, the comment is wrong for one of the two node types this visitor dispatches on.

### FG001: The helper's rationale names one nesting shape and compares against deleted code

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-stmt.cpp:108-111`
- GitHub link: https://github.com/shader-slang/slang/pull/14119/files#diff-b92ce6a8de0f3f3208b7ea596996194853be20445e43a397fbbe75d8e103b87cR108
- Overlap decision: Keep
- Overlap rationale: This is about the rationale paragraph's coverage and wording. C002 asks about invariants and C003 about other scope owners, which are separate requests about the same helper.
- Scope decision: Direct
- Scope rationale: The doc comment is new in this PR.

Context:

```cpp
/// reference (see `_isUncheckedLocalVar`). The parser gives an unbraced statement body no scope
/// of its own and adds `b` to the block's scope although its `DeclStmt` is nested in the `if`,
/// so we hide every variable the scope owns rather than only those declared by the block's
/// direct statements.
```

Proposed comment:

> This paragraph explains why ownership is the criterion with one shape, an unbraced `if` body. The PR also relies on the helper for two other shapes: a labeled declaration (`inner: int f = 1;`) and HLSL's `for` initial statement, whose variable belongs to the enclosing block. The phrase "rather than only those declared by the block's direct statements" reads as a comparison with the implementation this PR deletes, which a future reader will not have in front of them. Could the paragraph state the general fact directly? A local's `DeclStmt` can be nested arbitrarily deep inside the statements of the scope that owns it, so ownership, not statement position, determines what must be hidden. Ideally it would list the shapes that produce that nesting.

Notes:
Labels and the HLSL `for` init are both tested (`readBeforeLabeledDecl` and `gh-14118-hlsl-for.hlsl`), so the doc comment is narrower than the tested contract.

### FG002: The new doc comment contradicts the parser's comment on `ReadyForParserLookup`

- Status: Keep
- Confidence: Medium
- Scope: Contextual
- Category: comments
- Location: `source/slang/slang-check-stmt.cpp:106-108`
- GitHub link: https://github.com/shader-slang/slang/pull/14119/files#diff-b92ce6a8de0f3f3208b7ea596996194853be20445e43a397fbbe75d8e103b87cR106
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the contradiction with the parser comment.
- Scope decision: Contextual
- Scope rationale: The stale parser comment predates the PR, but the PR's new correctness argument explicitly depends on the opposite claim, and reconciling them is a one-sentence fix.
- Judgment decision: Keep
- Judgment rationale: A grep finds no code that resets body-stage locals to `Unchecked`, and `Decl::setCheckState` asserts that the state never decreases. The parser comment is therefore stale, and a reader verifying the PR's premise will hit the contradiction. The ask is small and local.

Context:

```cpp
/// Body-stage parsing leaves every local in the `ReadyForParserLookup` state, so the check
/// state alone does not make lookup skip `b`; the `hiddenFromLookup` flag rejects the forward
/// reference (see `_isUncheckedLocalVar`).
```

```cpp
// slang-parser.cpp:6163-6170 (unchanged)
        // When we are in a deferred parsing stage for function bodies,
        // we will mark all local var decls as `ReadyForParserLookup` so they can
        // be returned via lookup.
        // ...
        // Before checking the decl in semantic checking, we will mark them back as
        // `Unchecked`.
```

Proposed comment:

> The fix's correctness argument depends on the claim that body-stage locals stay `ReadyForParserLookup`. The parser comment where that state is set (`slang-parser.cpp:6169-6170`) says the opposite: "Before checking the decl in semantic checking, we will mark them back as `Unchecked`." I could not find any code that does this, and `Decl::setCheckState` asserts that the state never decreases, so the parser comment looks stale. A reader who checks this claim against the parser will find two contradicting comments. Could you correct the stale one so that the premise this fix relies on is stated consistently?

Notes:
The parser comment is outside the diff, so this candidate is attached to the new sentence that contradicts it. The proposed comment names the exact parser location.

### FG004: The test comments describe the rule in terms of run order and checker order

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: terminology
- Location: `tests/bugs/gh-14118.slang:1-3`
- GitHub link: https://github.com/shader-slang/slang/pull/14119/files#diff-96ad8519946c924ea671ef9bba075f8e5dc28131680d936dcb25e7a6da16de37R1
- Overlap decision: Keep
- Overlap rationale: C001 covers the `doPredicateAfterBody` comment's semantic claim. This candidate covers the wording of the header and the `for` and `while` comments, which is a different problem.
- Scope decision: Direct
- Scope rationale: The test file is new in this PR.

Context:

```slang
// A local declared as the unbraced body of a statement is owned by the
// enclosing scope, but it must stay invisible to code that runs before its
// declaration, just like a local declared directly in a block (gh-14118).
...
// The predicate and the side-effect expression of a `for` are checked before
// its body, so they must not see a local declared as the body.
...
// A `while` predicate is checked before its body, so it must not see a local
// declared as the body.
```

Proposed comment:

> The header describes the rule in terms of code "that runs before its declaration", but the visibility being tested is lexical, not dynamic. The `forSideEffectBeforeBody` case shows the difference: the side-effect expression runs after the body on every iteration, yet the test requires that it not see the body's `i`. The `for` and `while` comments then justify the expected language behavior with the checker's visit order ("are checked before its body, so they must not see..."). That gets the dependency backwards: a regression test should state the scoping rule it locks in, and the visit order is an implementation detail. Could these comments state the source-order rule directly?

Notes:
The `for` and `while` comments are at `tests/bugs/gh-14118.slang:70-71` and `:88-89`.

### FG005: Test function order and output order disagree

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: organization
- Location: `tests/bugs/gh-14118.slang:156-157`
- GitHub link: https://github.com/shader-slang/slang/pull/14119/files#diff-96ad8519946c924ea671ef9bba075f8e5dc28131680d936dcb25e7a6da16de37R156
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the test's organization.
- Scope decision: Direct
- Scope rationale: The test file is new in this PR, and the fix is a mechanical reorder.

Context:

```slang
    // CHECK-NEXT: 7
    outputBuffer[7] = doPredicateAfterBody();
    ...
    // CHECK-NEXT: 7
    outputBuffer[10] = whilePredicateBeforeBody(7);
```

Proposed comment:

> `whilePredicateBeforeBody` is defined between the `for` cases and `doPredicateAfterBody`, but it writes the last output slot, after the controls. When a `CHECK-NEXT` fails, the reader has to map the slot index back to a function that is not where they expect it. Could the definitions and the `outputBuffer` slots follow the same order?

Notes:
This is minor but cheap to fix in a new file.

## Dropped

### FG003: The `for` comment's wording ("the latter", "checked before") obscures the rule

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-check-stmt.cpp:319-321`
- GitHub link: https://github.com/shader-slang/slang/pull/14119/files#diff-b92ce6a8de0f3f3208b7ea596996194853be20445e43a397fbbe75d8e103b87cR319
- Overlap decision: Merged into C004
- Overlap rationale: This covers the same three-line comment as C004. One combined comment about accuracy and wording is clearer than two.
- Scope decision: Direct
- Scope rationale: The comment is new in this PR. The candidate was dropped only for overlap.

Proposed comment:

> "The latter" refers back across a sentence boundary and an inline code example, so it takes a re-read to see that it means the body declaration and not the initial-statement variables. The sentence also mixes the language rule with the implementation reason. The predicate and side-effect expressions must not see the body's local because they come before its declaration in source. The hiding is needed because they are also checked before the body's `DeclStmt` reveals it. Could the comment separate the two, so it is clear what is required and why this call achieves it?

### FG006: Null-`scopeDecl` handling is asymmetric between the two call sites

- Status: Drop
- Confidence: Low
- Scope: Direct
- Category: function contract
- Location: `source/slang/slang-check-stmt.cpp:113-116`
- GitHub link: https://github.com/shader-slang/slang/pull/14119/files#diff-b92ce6a8de0f3f3208b7ea596996194853be20445e43a397fbbe75d8e103b87cR113
- Overlap decision: Keep
- Overlap rationale: No overlap. The candidate was dropped on usefulness.
- Scope decision: Direct
- Scope rationale: The helper and the unguarded `visitForStmt` call are new.
- Judgment decision: Drop
- Judgment rationale: Both `ForStmt` creators (`ParseForStatement` and `ASTSynthesizer::emitFor`) always set `scopeDecl`. The guard on the block side predates the PR because some synthesized `BlockStmt`s lack a scope, and a null dereference here would fail loudly at once. Asking for an assertion adds little.

Proposed comment:

> The `visitBlockStmt` call is inside `if (stmt->scopeDecl)`, but the `visitForStmt` call is unguarded, and the helper dereferences its argument. Is a non-null `ForStmt::scopeDecl` an invariant? If so, an assertion in the helper would state the precondition.

### FG007: `hiddenFromLookup` has no field-level contract, and the PR widens its use

- Status: Drop
- Confidence: Low
- Scope: Probably out-of-scope
- Category: type contract
- Location: `source/slang/slang-check-stmt.cpp:113`
- GitHub link: https://github.com/shader-slang/slang/pull/14119/files#diff-b92ce6a8de0f3f3208b7ea596996194853be20445e43a397fbbe75d8e103b87cR113
- Overlap decision: Superseded by C002
- Overlap rationale: C002 asks for the hide/reveal contract on the new helper, which is the better-scoped home for the same documentation.
- Scope decision: Out-of-scope
- Scope rationale: The field and its missing comment predate the PR, and the new helper's doc comment already documents most of the protocol.

Proposed comment:

> `Decl::hiddenFromLookup` has no comment. This PR changes which declarations set it: previously only direct-child `DeclStmt`s of a block, now every `VarDecl` that a block or `for` scope owns. Consider documenting the protocol on the field: who sets it, who clears it, and that lookup honors it only for local variables.

## Result (machine-readable)

`bugs`/`gaps`/`questions` are Reviewer A's counts from the summarizer; the lead verdict above adds G2 and 5 nits.

```json
{"verdict":"REQUEST_CHANGES","bugs":0,"gaps":1,"questions":1,"diff_hash":"fe6020b423a1aa9be5f5a4a7aa85d6c314c13fa5fab178036c605ec0cb87e558","reviewers_complete":true}
```
