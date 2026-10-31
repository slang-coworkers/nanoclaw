# Combined PR Review — shader-slang/slang#14115 (pr)

Head `ea4cbbfe0` · round 1 · requester slang-fixer

## Lead verification (slang-reviewer)

I reviewed head `ea4cbbfe0` (draft, `pr: breaking change`) against merge-base `5a2dc5f21`. Current master `7d679e657` is still at module version 37, and `git merge-tree` merges the PR into it cleanly. Both builds are Release with `libslang-llvm.so` present, run on an NVIDIA L40S.

### Verdict: APPROVE_WITH_NITS (0 bugs, 0 gaps, 0 questions)

The fix is at the right layer. The parser now gives every `for` one scope shape, so the HLSL-only AST class and its lowering special case are gone, and no consumer patches anything. I confirmed that no `UnscopedForStmt` reference remains in `source/` or `tools/`. The module-version bump is required: in the generated `ASTNodeType` order, `UnscopedForStmt` (position 385) comes before `BasicExpressionType` (position 524). The result matches DXC on every shape I probed. All three maintainer requirements are met. The nits below are comment and test-clarity items, plus one Risk-line addition, and none needs another review round.

### Maintainer direction and issue requirements (checked live, 2026-10-31 01:00Z)

| # | Requirement | Source | Status | Evidence |
|---|---|---|---|---|
| M1 | "implement the proper scoping all developers writing code these days expect" | [tangent-vector, #14099 c6535132734](https://github.com/shader-slang/slang/issues/14099#issuecomment-6535132734) | met | `slang-parser.cpp:7795-7798,7829`: always `ForStmt`, always push and pop. The DXC 1.9 probe matches (see below). |
| M2 | "I just don't think there are enough developers in that intersection to justify any further workarounds" | same | met | No flag, no warning, no fallback. `-Gec` is not extended. |
| M3 | Breaking change accepted ("technically be a breaking change … If the authors of FXC already moved on, I think we can too") | same | met | Label `pr: breaking change`. The Risk line discloses "post-loop use now errors or reads an outer name". |
| IR1 | Sibling loops compile (issue expected behavior; reporter pdeayton-nv, so this is an issue requirement, not maintainer direction) | [#14099 body](https://github.com/shader-slang/slang/issues/14099) | met | `repro.hlsl` gives 7 errors on base and 0 on head. Pinned by `siblingLoops` (631). |

Where I differ from the fixer's self-check:
- (a) The fixer lists the issue body as "Maintainer direction". It is the reporter's text, so I count it as an issue requirement.
- (b) R3 ("UnscopedForStmt removed") is the fixer's own choice, not something tangent-vector asked for. It is a sound choice, and the fixer correctly flags commit 3 as separable.

Otherwise I agree.

### What I ran

- **New tests on base vs head.** `tests/hlsl/for-loop-variable-scope.slang` fails on base in all three rows (cpu, vk, and synthesized CUDA), because the file does not compile (E30200 ×7, E39999 ×26). On head all three rows pass. `tests/diagnostics/hlsl-for-loop-variable-scope.slang` fails on base and passes on head. In `tests/spirv/debug-lexical-scope-hlsl-for.slang`, the HLSL row fails on base and passes on head. The Slang row passes on both, which is expected because Slang mode is unchanged.
- **Full suite on head:** 11127/11130 pass, 3221 ignored. The 3 failures are `fp8-cuda*`, and I re-ran them on base, where they fail 0/3 too. `irBlobRejectsVersion37`, `irBlob` and `irBlobImportUpToDateCheck` pass.
- **`slang-static-unit-test`** (STATIC build, CI flags): 61 passed, 0 failed. This includes `serializedModuleVersionValidation`, which derives its values from the constants.
- **Cross-build module drill.** A module built by base (v37) and imported by head gives `warning[E00131]: ignoring IR module version 37 … supports … 38 through 38`, then falls back to source and succeeds. The reverse direction is symmetric. A module built by head loads in head. There is no misdecode in either direction.
- **HLSL corpus drill.** I ran 253 HLSL inputs that contain `for (` through `-lang hlsl -no-codegen` on base and head: 245 from DXC's own `HLSLFileCheck`/`CodeGenSPIRV` tests, plus every `.hlsl` or `-lang hlsl` test in `tests/` with a loop. This also covers D3D-only tests that the Linux suite skips. 236 are identical. 16 lose base errors on head (E30200/E39999 for sibling loops, e.g. `BC7Encode_TryMode*.hlsl`, `OIT_SortAndRenderCS.hlsl`, DXC's own `Wno-for-redefinition.hlsl`). 1 gains an error: `CbufferLegacy/cbuffer_copy1.hlsl`, `return tmp + i` after the loop, now E30015. **DXC 1.9 rejects that same shape** ("use of undeclared identifier 'i'") at `-HV 2016`, `2018` and `2021`, so this is the intended break and matches DXC. One file gains a warning (E39019) only because base had stopped at its earlier errors. There are 0 unexpected differences.
- **DXC semantics for the silent case.** For `static int i = 3; … for (int i …) {} return i;`, DXC 1.9 stores 3.0 at every `-HV`. Head also reads the global (`static int i_0 = int(3)`). Base read the loop variable.

### Disagreements between reviewers

1. **A's first finding is refuted**: "`outerVariableBeforeLoop` returns 207 both before and after the fix". I compiled that function on its own on base, with no other function in the file, so nothing else causes E30200. Base gives **200**, not 207, on CPU and on synthesized CUDA. The base HLSL output shows why: `int value_0 = i_0;` reads a generated global that stands in for the loop's not-yet-declared `i`. This is the miscompile the triage described. A's `_isUncheckedLocalVar` argument does not hold for this shape. The test case does distinguish the two behaviors, and the PR description's "a read before the loop could bind it" is correct. C002's reading (the inner braces are load-bearing) is the right one.
   - A's suggested extra shape (a read after the loop inside a nested block) is also a silent change: base returns the loop's `i` (2), head returns 7. But it is the same mechanism that `parameterAfterLoop` and `globalAfterLoop` already pin, so adding it is optional.
2. **The PR description does not use the CLAUDE.md five-part format (Devin flag 2, C summary).** The fleet's hook enforces the four-section description of at most 1,000 characters, and the explanation comment ([c6536616490](https://github.com/shader-slang/slang/pull/14115#issuecomment-6536616490)) carries the motivation, the per-commit rationale, and the "not done, by choice" alternatives. Under fleet policy this is not a finding. Whether that satisfies the repo's format is a call for a human.
3. **Generated design docs (Devin flag 1, C005 dropped).** `docs/generated/design/name-resolution/scopes.md` and `ast-reference/statements.md` still describe `UnscopedForStmt`. `regenerate.py list-stale` already reports both as `stale` on base, they are regenerated by their own operator workflow, and `regenerate.py lint` passes on head. I agree they are not blocking. The explanation comment already says so.

### Nits (apply without another round)

- **N1 (C001):** Add one sentence on `ParseForStatement`, or on `ForStmt` in `slang-ast-stmt.h:215`, recording the decision: initializer declarations are scoped to the loop in every source language, HLSL included, matching DXC (#14099). Today the rule is visible only as the absence of a branch, which makes a later "HLSL compat fix" easy to reintroduce.
- **N2 (A-2, C003, FG004):** In `unit-test-ir-blob.cpp`, derive the rejected version as `IRModule::k_minSupportedModuleVersion - 1`, as `tools/slang-static-unit-test/unit-test-module-version.cpp:302` already does, and build the expected text from it. Then:
  - give the test a version-neutral name, or keep the name if renaming is too much churn;
  - state the invariant in the header and drop the history;
  - drop or neutralize the "`uint` type, whose AST node ID changed" fixture line. The test serializes with the current numbering, so the fixture's content does not matter.
- **N3 (C002):** Add one short comment per case in `tests/hlsl/for-loop-variable-scope.slang`, saying which old failure the case guards: a compile error (sibling loops, declaration after the loop, outer variable after the loop) or silent mis-binding (`outerVariableBeforeLoop` (the inner braces are load-bearing; base gave 200), `parameterAfterLoop`, `globalAfterLoop`).
- **N4 (FG002):** In `slang-ir.h:2249`, change "an older module's later AST nodes" to "nodes whose classes come after the added or removed class in `ASTNodeType` order".
- **N5 (Risk line):** Add that 8 other open PRs also set module version 38: #14114, #14051, #13992, #13953, #13872, #13792, #13564, #13425. #13885 sets 39. When two PRs make the identical edit, git merges them without a conflict, so the second PR to land must move to 39 by hand.
- Optional: C004, one header sentence on the `DebugScope [[FOR]]` → `CHECK-NEXT: DebugScope [[FUNC]]` pair.

### Open for humans (not blocking)

- pdeayton-nv: sign off that `debug-lexical-scope-hlsl-for.slang` keeps what #13219 cared about.
- Keep or drop commit 3. Keeping it removes dead AST and costs a min-version bump that rejects every v37 module, which falls back to source as shown above. Dropping it keeps v37 modules loadable, but leaves `UnscopedForStmt` unused.

Artifacts: `runs/{A,B,C}-14115-r1`, `probes-14115/` (probes, `drill2.tsv`, DXC sparse clone), worktrees `wt-14115-{revA,verify,base}`, `wt-14115-verify/build-static`.

## Reviewer A — Correctness (nv-slang-bot)

**Verdict**: ✅ Clean — no significant issues found (2 clarity comments)

The PR removes `UnscopedForStmt`, so `Parser::ParseForStatement` now always pushes the loop's `ScopeDecl`. HLSL `for` initializer variables are therefore scoped to the loop, as they are in Slang. It also bumps the serialized module version range from 37 to 38, because removing an AST class renumbers `ASTNodeType`. None of the code-quality, test-coverage, IR, security or documentation reviewers found a bug or gap that meets the severity and confidence bar. They checked four things:
- No early return sits between the scope push and pop, so the scope stack stays balanced.
- The version gate runs before any AST is decoded.
- Nothing else references `UnscopedForStmt`.
- The new tests really parse as HLSL and fail on master.

The two inline comments are about test clarity.

<details>
<summary>Changes Overview</summary>

**HLSL `for` scoping in the parser and AST** (`source/slang/slang-parser.cpp`, `source/slang/slang-ast-stmt.h`, `source/slang/slang.natvis`)
- What changed: `ParseForStatement` used to build an `UnscopedForStmt` for `SourceLanguage::HLSL` and skip `pushScopeAndSetParent`/`PopScope`, so the initializer's variables leaked into the enclosing block. It now always builds a `ForStmt` and pushes and pops the scope. The class and its natvis entry are deleted.

**Debug lexical blocks** (`source/slang/slang-lower-to-ir.cpp`)
- What changed: `maybeEmitDebugLexicalBlock` no longer returns early for `UnscopedForStmt`. HLSL `for` loops now get a `DebugLexicalBlock` that contains the loop variable, with the body's block nested under it, the same as Slang loops.

**Module version gate** (`source/slang/slang-ir.h`, `tools/slang-unit-test/unit-test-ir-blob.cpp`)
- What changed: `k_minSupportedModuleVersion` and `k_maxSupportedModuleVersion` go from 37 to 38. The `irBlobRejectsVersion36` unit test is retargeted as `irBlobRejectsVersion37`, and its fixture comment now points to `uint`, a `Val`-subtree class whose `ASTNodeType` value shifts.

**Tests** (`tests/hlsl/for-loop-variable-scope.slang`, `tests/diagnostics/hlsl-for-loop-variable-scope.slang`, `tests/spirv/debug-lexical-scope-hlsl-for.slang`; deleted `tests/spirv/debug-lexical-scope-unscoped-for.slang`)
- What changed: a CPU/VK runtime test for sibling, nested and shadowing loops, which uses `-source-language hlsl`. An E30015 diagnostic test for reading the loop variable after the loop. A SPIR-V debug-scope test run in both HLSL and Slang modes. The old test, which asserted that the HLSL variable leaks, is removed.

</details>

<details>
<summary>Findings (2 total)</summary>

| Severity | Location | Finding |
|----------|----------|---------|
| 💬 Clarity | `tests/hlsl/for-loop-variable-scope.slang:40` | `outerVariableBeforeLoop` returns 207 both before and after the fix, so it does not check what the header claims. |
| 💬 Clarity | `tools/slang-unit-test/unit-test-ir-blob.cpp:483` | The rejected version is hardcoded in four places instead of derived from `k_minSupportedModuleVersion`. |

</details>

<sub>reviewed: ea4cbbfe0359dd0528f2b8d7144389f09508ef96 · diff sha256 b532f8115ddc</sub>

---

### `tests/hlsl/for-loop-variable-scope.slang:40`

💬 **Clarity**: `outerVariableBeforeLoop` passes both before and after the fix

The file header says code outside a loop "sees the enclosing `i`, never the loop's", and this case looks like the read-before-loop half of that claim. It also returns 207 under the old `UnscopedForStmt` parsing, for two reasons:
- The loop's `i` went into the inner block's scope. That scope has a different parent from the outer `i`, so there was no E30200 redeclaration error.
- `value = i` still bound the outer `i`. Lookup skips local variables that have not been checked yet (`_isUncheckedLocalVar`, `source/slang/slang-lookup.cpp:174`), and the loop's `i` is unchecked at that point.

So this case does not tell the old and new behavior apart. The PR description's "a read before the loop could bind it" has the same problem.

One shape that silently returned a wrong value before has no value check: a read *after* the loop inside the same nested block. `parameterAfterLoop` and `globalAfterLoop` cover only the function-scope versions.

```hlsl
int outerVariableAfterLoopInNestedBlock()
{
    int i = 7;
    int value = 0;
    {
        for (int i = 0; i < 2; ++i) {}
        value = i; // old parser: the loop's i (2); now: the outer i (7)
    }
    return value;
}
```

**Suggestion**: Replace this case with the nested-block after-loop shape, or add that shape next to it (expected `7`). Alternatively, say in a comment that `outerVariableBeforeLoop` checks the two parsers agree, and doesn't catch a regression.

---

### `tools/slang-unit-test/unit-test-ir-blob.cpp:483`

💬 **Clarity**: the rejected version is hardcoded in four places

The rejected version appears in the test name (`irBlobRejectsVersion37`), the header comment, `olderVersion = 37`, and the expected text `"cannot load IR module version 37"`. All four changed in this bump and will change again at the next AST renumbering. The header now records the history of the latest bump ("Removing `UnscopedForStmt` changes the numeric AST node IDs in version 38"). What the test actually checks is a durable rule: a real serialized module whose version is just below `IRModule::k_minSupportedModuleVersion` is rejected with the version-specific diagnostic. `tools/slang-static-unit-test/unit-test-module-version.cpp:302` already writes that as `k_minSupportedModuleVersion - 1`.

**Suggestion**: Derive the version from the constant and give the test a version-neutral name (for example `irBlobRejectsOlderModuleVersion`), so a future bump only changes `slang-ir.h`:

```cpp
const UInt64 olderVersion = IRModule::k_minSupportedModuleVersion - 1;
...
SLANG_CHECK(diagnosticText.contains(
    String("cannot load IR module version ") + String(olderVersion)));
```

## Reviewer B — Devin Review

# Devin Review

## AI Analysis

HLSL for loops now scope their initializer variable to the loop, matching C++, DXC and Slang. Sibling loops can each declare i, and code after a loop no longer binds to the loop's variable.

Removes UnscopedForStmt and always pushes a loop scope in ParseForStatement.
Drops the lowering special case that kept HLSL initializers in the enclosing block.
Bumps the serialized IR module version to 38 because AST node IDs shift.
Adds runtime, diagnostic and SPIR-V debug-scope tests and rewrites the old unscoped-for test.
Show less

Summary. HLSL for loops now scope their initializer variable to the loop, as C++, DXC and Slang do, so sibling for (int i…) loops compile and code outside a loop never binds to the loop's variable. Root cause. ParseForStatement (slang-parser.cpp:7792) built an UnscopedForStmt for HLSL and skipped the loop scope, so the variable joined the enclosing block (FXC's rule): E30200/E39999, and a read before the loop could bind it. Tests. New runtime test (cpu/vk/cuda), diagnostic test and SPIR-V debug-scope test; full suite: no new failures (3 fp8 CUDA tests fail, as on master). Risk. Breaking: post-loop use now errors or reads an outer name; tests/spirv/debug-lexical-scope-unscoped-for.slang (#13219, by reporter/assignee pdeayton-nv) reads i after the loop, so this PR rewrites it; pdeayton-nv, please weigh in. Module 37→38.

Fixes #14099

🤖 Generated by an automated Slang coworker — may be inaccurate. A human maintainer should verify.

Show less
266 lines left
1
Remove UnscopedForStmt and always scope for loops in the parser
0/3
slang-parser.cpp
source/slang
+3
−26
Viewed
All 7791 lines
5 lines
7792
ForStmt* Parser::ParseForStatement()
7793
{
7794
    ScopeDecl* scopeDecl = astBuilder->create<ScopeDecl>();
7795
 
7796
    // HLSL implements the bad approach to scoping a `for` loop
7797
    // variable, and we want to respect that, but *only* when
7798
    // parsing HLSL code.
7799
    //
7800
 
7801
    bool brokenScoping = getSourceLanguage() == SourceLanguage::HLSL;
7802
 
7803
    // We will create a distinct syntax node class for the unscoped
7804
    // case, just so that we can correctly handle it in downstream
7805
    // logic.
7806
    //
7807
    ForStmt* stmt = nullptr;
7808
    if (brokenScoping)
7809
    {
7810
        stmt = astBuilder->create<UnscopedForStmt>();
7811
    }
7812
    else
7813
    {
7814
        stmt = astBuilder->create<ForStmt>();
7815
    }
7816
 
1
7795
    ForStmt* stmt = astBuilder->create<ForStmt>();
7796
    stmt->scopeDecl = scopeDecl;
All 1 line
7819
    if (!brokenScoping)
7820
        pushScopeAndSetParent(scopeDecl);
7798
    pushScopeAndSetParent(scopeDecl);
All 1 line
7800
    ReadToken("for");
5 lines
All 26 lines
5 lines
7827
    stmt->statement = ParseStatement();
All 1 line
7851
    if (!brokenScoping)
7852
        PopScope();
7829
    PopScope();
7830
 
7831
    return stmt;
7832
}
5 lines
All 3450 lines
slang-ast-stmt.h
source/slang
−8
Viewed
All 206 lines
5 lines
207
// A statement that represents a loop, and can thus be escaped with a `continue`
208
FIDDLE(abstract)
209
class LoopStmt : public BreakableStmt
210
{
211
    FIDDLE(...)
212
};
213
 
214
// A `for` statement
215
FIDDLE()
216
class ForStmt : public LoopStmt
217
{
218
    FIDDLE(...)
219
    FIDDLE() Stmt* initialStatement = nullptr;
220
    FIDDLE() Expr* sideEffectExpression = nullptr;
221
    FIDDLE() Expr* predicateExpression = nullptr;
222
    FIDDLE() Stmt* statement = nullptr;
223
};
224
 
1
225
// A `for` statement in a language that doesn't restrict the scope
226
// of the loop variable to the body.
227
FIDDLE()
228
class UnscopedForStmt : public ForStmt
229
{
230
    FIDDLE(...)
231
};
232
 
225
FIDDLE()
226
class WhileStmt : public LoopStmt
227
{
5 lines
All 93 lines
2
Drop the HLSL lowering special case for UnscopedForStmt
0/1
3
Bump IR module version to 38 and update the version test
0/2
4
Add HLSL for-loop scope tests and rewrite the old unscoped test
0/4
End of changes
Chat about this PR
Info
Chat

## Vulnerabilities

(none reported)

## Bugs

(none reported)

## Flags

Design guides retain obsolete HLSL scoping
Investigate
slang-ast-stmt.h:225-231
Required process report is absent
Investigate
slang-parser.cpp:7795-7798

## Informational

(none reported)

## Reviewer C — Clarity

# PR 14115 Clarity Workflow Candidates

Canonical file for shader-slang/slang#14115 ("Scope HLSL for-loop variables to the loop"),
head `ea4cbbfe0359dd0528f2b8d7144389f09508ef96`. Merged from
`pr-14115-clarity.md` (C-prefix) and `pr-14115-fine-grained-clarity.md` (FG-prefix), then scope
filtered and judgment-resolved. Not posted; posting is owned by the wrapping workflow.

## PR Summary

- **What the PR says:** HLSL `for` loops now scope their initializer variable to the loop, as
  C++, DXC and Slang do. Previously, `ParseForStatement` built an `UnscopedForStmt` for HLSL and
  skipped pushing the loop scope (FXC's rule). That caused redeclaration errors for sibling
  `for (int i…)` loops and let reads outside the loop bind to the loop variable. The PR is
  labeled `pr: breaking change` and is a draft. Fixes #14099.
- **What the diff does:** deletes the `UnscopedForStmt` AST class (`slang-ast-stmt.h`), its
  natvis entry, and its early-out in `maybeEmitDebugLexicalBlock`. Makes `ParseForStatement`
  always create a `ForStmt` and push/pop its `scopeDecl`. Bumps the module version 37→38,
  because removing an AST class renumbers `ASTNodeType`, and updates the `slang-ir.h` comment and
  the `irBlobRejectsVersion36` → `irBlobRejectsVersion37` unit test. Adds a runtime test (cpu/vk;
  CUDA is synthesized from the CPU line by slang-test), a diagnostic test, and an HLSL+Slang
  SPIR-V debug-scope test. Deletes the old HLSL "unscoped for" debug-scope test, whose
  expectation this PR reverses.
- **Match:** The description matches the diff. The only mismatch is format: the PR body uses
  Summary/Root cause/Tests/Risk rather than the five-part format CLAUDE.md requires.
- **Value:** A principled fix. It removes an alternate AST representation instead of adding
  another HLSL guard, so downstream consumers get simpler. The compiler-side change is about 30
  deleted lines and 3 added.

## Review Body

> Claude Opus 5.5-authored clarity review:
>
> This is a small, well-shaped change. Rather than adding another HLSL special case, it removes the `UnscopedForStmt` alternate representation, so every `for` loop parses into the same `ForStmt` with a pushed `scopeDecl`. The lowering and natvis special cases go away with it. The compiler-side diff is easy to follow, and the module-version bump is the necessary result of removing an AST class. From a clarity standpoint the PR feels close to merge-ready. The comments below are mostly about keeping the intent visible in the code and tests, not about the approach.
>
> ## Main things to look at
>
> - **Record the decision where the branch used to be.** The removed parser comment was the only place that explained HLSL scoping. Now the "HLSL follows DXC, not FXC" rule exists only as missing code. One sentence on `ParseForStatement` or `ForStmt` would keep a later "HLSL compatibility fix" from reintroducing the old behavior.
> - **Make the runtime test cases explain themselves.** Each function in `tests/hlsl/for-loop-variable-scope.slang` guards a specific old failure: either a compile error or a silent mis-binding to the loop variable. The inner braces in `outerVariableBeforeLoop` are what make that case work. None of this is written down, and the expected values are unexplained numbers.
> - **Version-bump comments in `irBlobRejectsVersion37`.** The header and fixture comments re-explain the latest AST change. The fixture justification doesn't connect to anything the test checks, and the hard-coded `37` means the next bump repeats this churn.
>
> Smaller items: a question about the `CHECK-NEXT` scope-marker pair in the new debug-scope test, and a wording nit in the `slang-ir.h` version comment.
>
> The PR description also doesn't follow the five-part format in `CLAUDE.md` (Motivation / Proposed solution / Change summary / Concepts and vocabulary / Process report). Because this is a breaking change, a short process report would help reviewers. It should explain why deleting the HLSL-specific AST class is the right fix, and say whether a legacy FXC-scoping option was considered and rejected.

## Kept

### C001: The loop-scoping contract now lives only in the absence of the old HLSL carve-out

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-parser.cpp:7795`
- GitHub link: https://github.com/shader-slang/slang/pull/14115/files
- Overlap decision: Keep
- Overlap rationale: Absorbs FG001, which asked for the same scoping contract on the `ForStmt` declaration; one comment offering either home is clearer than two.
- Scope decision: Direct
- Scope rationale: The PR deleted the only comment that explained `for` scoping by language and rewrote this function body.

Context:

```cpp
ForStmt* Parser::ParseForStatement()
{
    ScopeDecl* scopeDecl = astBuilder->create<ScopeDecl>();
    ForStmt* stmt = astBuilder->create<ForStmt>();
    stmt->scopeDecl = scopeDecl;

    pushScopeAndSetParent(scopeDecl);
    ...
    stmt->statement = ParseStatement();

    PopScope();
```

```cpp
// slang-ast-stmt.h (unchanged context)
// A `for` statement
FIDDLE()
class ForStmt : public LoopStmt
```

Proposed comment:

> Before this PR, this function had an explicit, commented decision to scope HLSL `for`
> initializers by FXC's rule. Now that the branch is gone, the new rule is recorded only by the
> fact that there's no branch. Nothing here says that the initializer's declarations are scoped
> to the loop in every source language, HLSL included, or that matching DXC is deliberate. The
> `ForStmt` declaration doesn't say it either: its comment is just "A `for` statement", and the
> comment on the removed `UnscopedForStmt` was what used to spell out the difference. A
> maintainer who later sees FXC-era HLSL that reads `i` after the loop has nothing telling them
> the old behavior was removed on purpose (#14099). Could one of these two places state the
> contract? It needs to say which parts of the loop see `scopeDecl` (initializer, predicate,
> side-effect expression, body), that code after the loop does not, and that HLSL follows the
> same rule as DXC.

Notes:
The PR is labeled breaking, so the semantic decision is worth anchoring in code. FG001 merged here.

### C002: Runtime test cases do not say which pre-fix failure each one guards

- Status: Keep
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `tests/hlsl/for-loop-variable-scope.slang:44`
- GitHub link: https://github.com/shader-slang/slang/pull/14115/files
- Overlap decision: Keep
- Overlap rationale: Absorbs FG005 (the load-bearing braces), which is the most concrete instance of this per-case-intent concern.
- Scope decision: Direct
- Scope rationale: New test file added by the PR.

Context:

```hlsl
int outerVariableBeforeLoop()
{
    int i = 7;
    int value = 0;
    {
        value = i;
        for (int i = 0; i < 2; ++i) { value += 100; }
    }
    return value;
}
...
    // CHECK-NEXT: {{^}}207{{$}}
    outputBuffer[3] = outerVariableBeforeLoop();
```

Proposed comment:

> The file header lists three properties, but the eight functions don't say which old failure
> each one rules out, and the old failures are of two different kinds. Some cases would have
> failed to compile under the old rule. For example, `declarationAfterLoop` and
> `outerVariableAfterLoop` would have hit a redeclaration error. Others would have compiled and
> silently bound to the loop variable: `parameterAfterLoop`, `globalAfterLoop`, and this one.
> The inner braces here are the least obvious part. As far as I can tell, they make the old rule
> put the loop's `i` in the inner block next to `value = i`, so the earlier read binds to it
> instead of the case collapsing into a redeclaration error with the outer `int i = 7`. Without
> a note, someone could "simplify" the braces away and quietly turn this into a different test.
> A short per-function note (which old behavior it catches, plus how values like `631`, `207`
> and `50053` come about) would let a reader check that each case still tests what it was
> written to test.

Notes:
Derived values: 631 = 1 + 30 + 600; 60 = 2*10 + 2*20; 6 = 2*(0+1+2); 207 = 7 + 2*100;
50053 = 50 + (0+1+2) + 50*1000; 9 = parameter; 3 = global. FG005 merged here.

### C003: Unit-test fixture comment justifies content the test does not depend on

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: correctness smell
- Location: `tools/slang-unit-test/unit-test-ir-blob.cpp:485`
- GitHub link: https://github.com/shader-slang/slang/pull/14115/files
- Overlap decision: Keep
- Overlap rationale: Adjacent to FG004 but a distinct problem: FG004 is about the header and hard-coded version, this is about a fixture rationale that no assertion relies on.
- Scope decision: Direct
- Scope rationale: The PR rewrote this comment line.

Context:

```cpp
SLANG_UNIT_TEST(irBlobRejectsVersion37)
{
    // The fixture includes the `uint` type, whose AST node ID changed in version 38.
    const char* moduleText = R"(
        module version_guard;
        public uint readValue(uint input) { return input + 1; }
    )";
```

Proposed comment:

> This comment suggests the fixture was picked to contain a node whose ID shifted in version 38.
> But the test serializes with the current compiler and only patches `m_version`. The serialized
> AST always uses current numbering, and rejection is decided by the version check alone. So I
> can't tell what having a shifted node contributes, or what would go wrong if the fixture had
> none. "The `uint` type" also doesn't name an AST class. As far as I can tell, removing a `Stmt`
> class shifts the `Expr` and `Val` classes that come after the `Stmt` subtree in `ASTNodeType`
> order, but not `ParamDecl`. That is why the old "function parameter" wording had to change. If
> the fixture's content matters, could the comment say how the test relies on it? If it doesn't,
> saying the fixture is arbitrary would save re-justifying it on every bump.

Notes:
Verified ordering: `NodeBase.subclasses` is a pre-order walk (tools/slang-fiddle/slang-fiddle-scrape.cpp:1663).
In slang-ast-base.h, `ModifiableSyntaxNode`'s children are `DeclBase` (757) then `Stmt` (825);
`SyntaxNode`'s `Expr` (815) subtree and `NodeBase`'s `Val` (380) subtree follow the
`ModifiableSyntaxNode` subtree. Wording revised from the raw candidate to mention `Expr` as well.

### FG004: Unit test header comment narrates the latest bump instead of the invariant, and duplicates `slang-ir.h`

- Status: Revise
- Confidence: Medium
- Scope: Direct
- Category: comments
- Location: `tools/slang-unit-test/unit-test-ir-blob.cpp:480-483`
- GitHub link: https://github.com/shader-slang/slang/pull/14115/files
- Overlap decision: Keep
- Overlap rationale: Distinct from C003; addresses the header comment and hard-coded version rather than the fixture rationale.
- Scope decision: Direct
- Scope rationale: The PR rewrote the header comment and every hard-coded `37` (name, `olderVersion`, diagnostic string), so the cleanup stays within lines the PR already edits.
- Judgment decision: Revise
- Judgment rationale: Deriving the version is feasible here: `slang/slang-serialize-types.h` includes `slang-ir.h`, and `tools/slang-static-unit-test/unit-test-module-version.cpp:302` already uses `k_minSupportedModuleVersion - 1`. The comment now leads with the history-vs-invariant problem and offers derivation as one option, not a mandate.

Context:

```cpp
// Removing `UnscopedForStmt` changes the numeric AST node IDs in version 38. This test verifies
// that a current module loads, then changes only its module version to 37 and requires rejection
// with the specific unsupported-version diagnostic.
SLANG_UNIT_TEST(irBlobRejectsVersion37)
...
    const UInt64 olderVersion = 37;
...
    SLANG_CHECK(diagnosticText.contains("cannot load IR module version 37"));
```

Proposed comment:

> This test checks a rule that doesn't depend on any particular version: a module whose version
> is just below `IRModule::k_minSupportedModuleVersion` is rejected with the version diagnostic.
> But the comment opens with the reason for the latest bump, which is already explained next to
> the constants in `slang-ir.h`. The number 37 also appears in the test name, the comment,
> `olderVersion`, and the expected diagnostic text. That is why this PR had to rewrite all of
> them, and the next bump will have to again, copying the AST-change explanation into a second
> place. Could the comment state the invariant instead, and leave the "why 38" reasoning only in
> `slang-ir.h`? One option: `IRModule` is already visible here through
> `slang/slang-serialize-types.h`, and `tools/slang-static-unit-test/unit-test-module-version.cpp`
> already derives `k_minSupportedModuleVersion - 1`, so the version here could be derived the
> same way.

Notes:
Hard-coded naming predates the PR (`irBlobRejectsVersion36`); kept because the PR touches every
affected line.

### C004: Debug-scope test pins a back-to-back `FOR`→`FUNC` marker pair without saying why

- Status: Revise
- Confidence: Low
- Scope: Direct
- Category: invariant
- Location: `tests/spirv/debug-lexical-scope-hlsl-for.slang:19-20`
- GitHub link: https://github.com/shader-slang/slang/pull/14115/files
- Overlap decision: Keep
- Overlap rationale: No other candidate covers the debug-scope test's CHECK sequence.
- Scope decision: Direct
- Scope rationale: New test file added by the PR.
- Judgment decision: Revise
- Judgment rationale: The `FOR` marker comes from lowering's rule that each newly entered block re-emits the active scope (`emitCurrentDebugScope`, slang-lower-to-ir.cpp:722). So `CHECK-NEXT` plausibly encodes a real property, "no merge-block instruction runs in the loop scope", rather than pure noise. Reworded from "artifact" to a question asking the author to state the property.

Context:

```text
// CHECK: [[MERGE]] = OpLabel
// CHECK-NOT: DebugScope [[BODY]]
// CHECK: DebugScope [[FOR]]{{$}}
// CHECK-NEXT: DebugScope [[FUNC]]{{$}}
// CHECK-NOT: DebugScope
// CHECK-NOT: DebugNoScope
// CHECK: OpStore
```

Proposed comment:

> The header explains which scope each `i` lives in. It doesn't explain the sequence after the
> merge label: a `DebugScope [[FOR]]` immediately followed (`CHECK-NEXT`) by
> `DebugScope [[FUNC]]`. I think the `FOR` marker comes from lowering's rule that a newly
> entered block re-emits the active scope, because the merge block is created while the loop's
> scope is still active. In that reading, `CHECK-NEXT` asserts that no merge-block instruction is
> attributed to the loop's scope before the switch to the function's scope. If that is the
> property being checked, a sentence in the header saying so (and tying it to the post-loop
> `outputBuffer[0] = i`) would make the expectation easy to verify. If it isn't, pinning the
> redundant marker means harmless marker cleanups will break the test. No other
> `debug-lexical-scope-*` test pins consecutive markers like this.

Notes:
Low confidence; included per workflow default for credible judgment-call candidates.

### FG002: "an older module's later AST nodes" is ambiguous

- Status: Keep
- Confidence: Low
- Scope: Direct
- Category: comments
- Location: `source/slang/slang-ir.h:2249-2252`
- GitHub link: https://github.com/shader-slang/slang/pull/14115/files
- Overlap decision: Keep
- Overlap rationale: Only candidate on the `slang-ir.h` comment; FG004 references that comment but asks for a different change.
- Scope decision: Direct
- Scope rationale: The PR rewrote this sentence into a general rule.

Context:

```cpp
    // Adding or removing an AST class shifts the sequential `ASTNodeType` values, so an older
    // module's later AST nodes would be decoded as different classes.
    // Version 38 is the earliest module version with the numbering that follows the removal of
    // `UnscopedForStmt`.
```

Proposed comment:

> Nit: "later AST nodes" could be read as nodes that appear later in the serialized module. I
> think it means nodes whose classes come after the added or removed class in `ASTNodeType`
> order, which is a pre-order walk of the class hierarchy. That distinction decides which modules
> are affected (removing a `Stmt` class shifts every `Expr` and `Val` ID but no `Decl` ID). Since
> the sentence is now written as the general rule, could it say "later" in terms of class
> numbering?

Notes:
Phrase carried over from the prior comment, but the PR generalized it.

## Dropped

### FG001: `ForStmt`'s type comment no longer has anything to contrast with

- Status: Drop
- Confidence: Low
- Scope: Contextual
- Location: `source/slang/slang-ast-stmt.h:223`
- Overlap decision: Merged into C001
- Overlap rationale: Same request (state the loop-scoping contract) at a second possible location; C001 now offers either home.
- Scope decision: Contextual
- Scope rationale: Preserved for audit; concern carried by C001.

Proposed comment:

> With `UnscopedForStmt` removed, `ForStmt` is the only `for` form. Its one-line comment never
> said what its inherited `scopeDecl` scopes, because the subclass's comment used to imply it by
> contrast. Could `ForStmt` state that `scopeDecl` holds the declarations from
> `initialStatement` and is visible to the predicate, side-effect expression and body, but not
> after the loop?

### FG005: The extra braces in `outerVariableBeforeLoop` are load-bearing but unexplained

- Status: Drop
- Confidence: Medium
- Scope: Direct
- Location: `tests/hlsl/for-loop-variable-scope.slang:44`
- Overlap decision: Merged into C002
- Overlap rationale: C002's comment now covers the braces as its leading concrete example.
- Scope decision: Direct
- Scope rationale: Preserved for audit; concern carried by C002.

Proposed comment:

> Without the inner braces, the old rule would put the loop's `i` in the same scope as
> `int i = 7`, and this case would become a redeclaration error instead of the "read before the
> loop binds to the loop's variable" bug the header describes. A comment would stop someone from
> "simplifying" the braces away.

### FG003: `maybeEmitDebugLexicalBlock` comment wrapping and contract

- Status: Drop
- Confidence: Low
- Scope: Direct
- Location: `source/slang/slang-lower-to-ir.cpp:9687-9689`
- Overlap decision: Keep
- Overlap rationale: No overlap.
- Scope decision: Out-of-scope
- Scope rationale: The missing return-value contract predates the PR, and the rewritten sentence accurately matches the `BlockStmt`/`ForStmt` guard. Only a trivial wrapping nit remains.

Proposed comment:

> The rewritten comment matches the `BlockStmt`/`ForStmt` check but still describes the language
> rather than the function: it doesn't say that this returns a new `DebugLexicalBlock` parented
> to the current debug scope, or `nullptr` otherwise.

### FG006: New tests cannot tell whether HLSL parsing is actually engaged

- Status: Drop
- Confidence: Low
- Scope: Direct
- Location: `tests/hlsl/for-loop-variable-scope.slang:1-2`
- Overlap decision: Keep
- Overlap rationale: No overlap.
- Scope decision: Direct
- Scope rationale: New test lines.
- Judgment decision: Drop
- Judgment rationale: Both flags are demonstrably wired. The deleted master test observed HLSL-only behavior with `-lang hlsl`, and render-test passes `-source-language` into the session `Language` option (tools/render-test/slang-support.cpp:161-173). The concern is speculative.

Proposed comment:

> Slang already scoped `for` initializers, so every expectation in the three new tests would also
> pass if the HLSL-selection flags were ignored. Nothing in the tests confirms they reach the
> HLSL parser path.

### C005: Generated design docs still describe `UnscopedForStmt`

- Status: Drop
- Confidence: Low
- Scope: Probably out-of-scope
- Location: `source/slang/slang-ast-stmt.h:223`
- Overlap decision: Keep
- Overlap rationale: No overlap.
- Scope decision: Out-of-scope
- Scope rationale: `docs/generated/design/_meta/regenerate.md` forbids hand-editing generated docs and treats drift as advisory, to be fixed by a separate regeneration workflow.

Proposed comment:

> Several pages under `docs/generated/design/` (scopes, AST statement reference) still describe
> `UnscopedForStmt` and the HLSL leak, which this PR removes.

## Coverage Audit

- `source/slang/slang-ast-stmt.h`: C001 (via merged FG001); C005 dropped.
- `source/slang/slang-ir.h`: FG002.
- `source/slang/slang-lower-to-ir.cpp`: FG003 dropped; removing the `UnscopedForStmt` early-out
  follows directly from deleting the class.
- `source/slang/slang-parser.cpp`: C001.
- `source/slang/slang.natvis`: mechanical removal, obviously correct; no candidate.
- `tests/diagnostics/hlsl-for-loop-variable-scope.slang`: the header states the rule and the
  issue, and the caret annotations match the `i` uses; no candidate.
- `tests/hlsl/for-loop-variable-scope.slang`: C002 (with FG005 merged in); FG006 dropped.
- `tests/spirv/debug-lexical-scope-hlsl-for.slang`: C004; the header is otherwise clear.
- `tests/spirv/debug-lexical-scope-unscoped-for.slang` (deleted): replaced by the new test, and
  the PR body explains why; no candidate.
- `tools/slang-unit-test/unit-test-ir-blob.cpp`: C003, FG004.

## Result (machine-readable)

```json
{"verdict":"APPROVE_WITH_NITS","bugs":0,"gaps":0,"questions":0,"diff_hash":"b532f8115ddcb0b6e2f9536d2b20864787ed0338232ae31bab6f851ec96196a0","reviewers_complete":true}
```
