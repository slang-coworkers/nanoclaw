---
title: "Slang Declaration-Order Scoping: hiddenFromLookup, Shapes That Escape It, and HLSL for-Init Scoping"
type: concept
group: slang-language-core
tags: [slang, scoping, lookup, hiddenFromLookup, declaration-order, forward-reference, _isUncheckedLocalVar, visitBlockStmt, checkDeclAtDeclarationPoint, ReadyForParserLookup, UnscopedForStmt, hlsl, fxc, dxc, for-loop, unbraced-body, target-switch, if-let, silent-wrong-binding, e30200, e39999]
source_count: 8
---

# Slang Declaration-Order Scoping: hiddenFromLookup, Shapes That Escape It, and HLSL for-Init Scoping

How the Slang checker stops a function-body local from being read before its declaration, which statement shapes slipped past that rule in October 2026 (#14099, #14118, #14120, PR #14119), how HLSL mode's FXC-style `for`-init scoping fits in (PR #14115), and the two drills that settle a scoping PR. The broader scope walk (`_lookUpInScopes`, function-local types, `using namespace`, self-referencing initializers, redeclaration gaps) is on [Slang Scope Lookup, Function-Local Types, and Declaration Checking](../concepts/slang-language-scope-lookup-and-declaration-checking.md); the "`hiddenFromLookup` only affects local vars" rule is on [Slang Compiler Casts, Lookup & Language Server](../concepts/slang-compiler-casts-lookup-and-language-server.md).

## TL;DR

- `Decl::hiddenFromLookup` is the ONLY declaration-order guard for function-body locals. Body-stage parsing leaves every local at `DeclCheckState::ReadyForParserLookup`, so the `Unchecked` test in `_isUncheckedLocalVar` never hides one.
- Do not "fix" a forward reference by treating `ReadyForParserLookup` as unchecked in lookup: parser-time lookups (`a < b` generic disambiguation) also pass `semantics` and must see those locals.
- The flag is set when a scope is entered and cleared in `checkDeclAtDeclarationPoint`. Any local whose scope is not hidden on entry is visible before its declaration.
- On master the hiding lives in `visitBlockStmt` and covers only DIRECT `DeclStmt` children of a `SeqStmt` body. Escapes: HLSL `for`-init decls, a Slang `for` scope, unbraced if/else/while/do bodies, `label: int x;`, a single-statement block, an unbraced `else` after `if let`, `__target_switch`/`__stage_switch` cases, unbraced `catch` and `$for` bodies.
- The symptom is a SILENT wrong binding, not an error: the read binds a later inner local, which lowers to an unwritten module-scope global (`int32_t z_0;`) in HLSL/C++, reads 0 on CPU/CUDA, and becomes a module-scope Function-storage `OpVariable` in SPIR-V (spirv-val rejects it; without validation slangc exits 0). DXC handles all of these shapes correctly.
- PR #14119's fix hides every `VarDecl` that the block's `ScopeDecl` owns. That needs every such local to have a `DeclStmt`; `$for` and GPU-foreach loop variables have none, so a blanket "hide every ScopeStmt's scope" would hide them forever.
- Hide/reveal assumes the checker visits declarations in source order. `visitDoWhileStmt` checked the predicate before the body and had to be swapped.
- Leaking a local declared as an unbraced body to the statements AFTER it is documented as intended and pinned by generated tests. A parser implicit-scope fix is therefore a language change; hiding is the non-breaking fix.
- Still open after PR #14119 (#14120): a `__target_switch` case's `ScopeDecl` is not stored on `TargetCaseStmt`, `CatchStmt` is not a `ScopeStmt`, and the `$for`/GPU-foreach scope holds a loop var without a `DeclStmt`.
- HLSL mode's `UnscopedForStmt` (FXC leak, deliberate since 2017) puts `for (int i…)` in the enclosing block: sibling loops give E39999 + E30200, and `{ value = i; for (int i…){} }` silently binds the inner `i`. DXC has no such leak at `-HV` 2016, 2018 or 2021.
- Maintainer direction on #14099: drop the FXC quirk and implement DXC/C++ scoping (`pr: breaking change`). When an HLSL-mode bug comes from FXC-compat legacy behavior, present the DXC-semantics fix as a first-class option instead of defaulting to a non-breaking workaround.
- A green suite does not prove a scoping change rebinds nothing. Instrument the lookup skip to log every decl hidden only by the new rule, then run the full suite and `docs/generated/tests`.
- For an HLSL parsing/scoping PR, diff base-vs-head `slangc -lang hlsl <file> -no-codegen` diagnostics over DXC's own test corpus. `-lang` must come before the file, use absolute paths, and sanity-check the code distribution before trusting a 0-diff.
- `parseIfLetStatement` returns a bare `SeqStmt` whose `ScopeDecl` has no `ScopeStmt`; wrapping it in a `BlockStmt` adds a `DebugLexicalBlock`, which changes `tests/spirv/debug-lexical-scope-if-let.slang`.

## How the checker hides a local until its declaration

Consider this example:

```slang
int f(int c)
{
    int i = 7;
    int value;
    {
        value = i;          // must read the outer i
        if (c) int i = 1;   // a later local in the same block scope
    }
    return value;
}
```

The rule that `value = i` must not see the later `i` is enforced by one mechanism only. Body-stage parsing (`slang-parser.cpp` ~6171) sets every local `VarDecl` to `DeclCheckState::ReadyForParserLookup`, and nothing resets it to `Unchecked`, so the unchecked/being-checked test in `_isUncheckedLocalVar` (`slang-lookup.cpp` ~174) never hides a function-body local. Only `Decl::hiddenFromLookup` does: it is set when the checker enters a scope and cleared in `checkDeclAtDeclarationPoint`. Treating `ReadyForParserLookup` as unchecked in lookup looks like a shortcut but is wrong, because parser-time lookups (for example the `a < b` generic-app disambiguation) also pass `semantics` and need to see those locals [hiddenFromLookup is the only declaration-order guard](../learnings/1793413823898-slang-checker-hiddenfromlookup-is-the-only-declara.md).

On master, `visitBlockStmt` (`slang-check-stmt.cpp` ~128-145) sets the flag only on DIRECT `DeclStmt` children of the block's body, and only when that body is a `SeqStmt`. Any local that lands in the block's `ScopeDecl` some other way is visible from the top of the block [unbraced-body locals are visible before their declaration (#14118)](../learnings/1793407983707-slang-local-declared-as-unbraced-if-else-while-do-.md).

## Shapes that escape the hiding

| Shape | Why the local is not hidden | Status |
|---|---|---|
| HLSL `for (int i…)` (`UnscopedForStmt`) | In HLSL mode `ParseForStatement` (~7801) pushes no `ScopeDecl`, so `i` joins the enclosing block's scope but is not a direct `DeclStmt` | #14099, PR #14115 |
| Slang `for` | `visitForStmt` never hid the for scope | PR #14119 |
| unbraced `if (c) int i = 1;`, `else`, `while`, `do` body | `parseIfStatement`/`ParseWhileStatement`/`ParseDoWhileStatement` push no scope; `parseVarDeclrStatement` adds the decl to `currentScope->containerDecl`, the enclosing block | #14118, PR #14119 |
| `label: int x;` | not a direct `DeclStmt` child | PR #14119 |
| single-statement block `{ int a = record(z), z = 5; }` | the body is not a `SeqStmt`, so nothing is hidden and `a` reads the LATER `z` | PR #14119 |
| unbraced `else int i` after `if let` | `parseIfLetStatement` returns a bare `SeqStmt` whose `ScopeDecl` has no `ScopeStmt`, so anything keyed on `BlockStmt::scopeDecl` misses it | PR #14119 |
| `__target_switch` / `__stage_switch` case: `case cpp: r = i; int i = 5;` | `parseTargetSwitchStmtImpl` pushes a per-case `ScopeDecl` that `TargetCaseStmt` never stores | open, #14120 |
| unbraced `catch` body | `CatchStmt` is not a `ScopeStmt` | open, #14120 |
| unbraced `$for` body, GPU foreach | the scope also holds the loop `VarDecl`, which has no `DeclStmt` | open, #14120 |

[forward-reference hiding misses single-statement blocks, `__target_switch` cases, unbraced catch/`$for` (#14120)](../learnings/1793415366185-slang-checker-forward-reference-hiding-misses-sing.md), [HLSL `UnscopedForStmt` for-init decls escape the hiding (#14099)](../learnings/1793391200596-slang-hlsl-unscopedforstmt-for-init-decls-escape-v.md), [`if let` scope and the drill facts from #14119](../learnings/1793416991584-slang-scoping-change-review-instrument-the-lookup-.md).

The failure is silent. The early read binds the inner, not-yet-declared local, which has no definition in that position, so lowering emits an unwritten module-scope global (`int32_t z_0;`) in HLSL and C++ and the value reads as 0 on `-cpu` and CUDA. SPIR-V gets a Function-storage `OpVariable` at module scope (an `OpLoad` of a variable that was never stored); spirv-val rejects it, slangc without validation exits 0, and a Vulkan run segfaulted on the L40S. DXC accepts every shape above and binds the outer name [#14118](../learnings/1793407983707-slang-local-declared-as-unbraced-if-else-while-do-.md), [#14120](../learnings/1793415366185-slang-checker-forward-reference-hiding-misses-sing.md).

## The fix shape: hide every local the scope owns (PR #14119, open as of 2026-10-31)

PR #14119 hides every `VarDecl` owned by the block's `ScopeDecl` instead of only direct `DeclStmt` children. Two constraints shape it [hiddenFromLookup is the only guard](../learnings/1793413823898-slang-checker-hiddenfromlookup-is-the-only-declara.md):

- Every hidden local must have a `DeclStmt`, because `checkDeclAtDeclarationPoint` is what reveals it. `$for` and GPU-foreach loop variables have none, so a generic "hide every `ScopeStmt`'s scope" would hide them forever. That is why those bodies stay open in #14120.
- Hide/reveal assumes the checker visits declarations in source order. `visitDoWhileStmt` checked the predicate before the body, so the order was swapped.

The fix hides, rather than adding an implicit scope in the parser, because the opposite leak is intended. `if (c) int x = 7; use(x);` (the local is visible AFTER the unbraced body) is documented in `docs/generated/design/name-resolution/scopes.md` and pinned by the generated tests `{if,while,do}-body-decl-without-block-leaks.slang`. A parser implicit-scope fix would break those and is a language change; hiding every local the block's `ScopeDecl` owns is the non-breaking fix [#14118](../learnings/1793407983707-slang-local-declared-as-unbraced-if-else-while-do-.md). Wrapping the `if let` `SeqStmt` in a `BlockStmt` adds a `DebugLexicalBlock`, so `tests/spirv/debug-lexical-scope-if-let.slang` needs a CHECK update [#14119 drill facts](../learnings/1793416991584-slang-scoping-change-review-instrument-the-lookup-.md).

## HLSL for-init scoping: DXC semantics over the FXC quirk (#14099, PR #14115)

`ParseForStatement` sets `brokenScoping = getSourceLanguage() == SourceLanguage::HLSL`, builds an `UnscopedForStmt` and skips pushing the for's `ScopeDecl`. That reproduces FXC's leak of `for (int i…)` into the enclosing block, deliberately, since 2017. Two consequences follow from the hiding gap above. Sibling `for (int i…)` loops give E39999 + E30200, because `checkRedeclaration` has no for-init exemption. And `int i = 7; { value = i; for (int i…){} }` compiles but binds `value = i` to the inner `i` [UnscopedForStmt for-init decls escape the hiding](../learnings/1793391200596-slang-hlsl-unscopedforstmt-for-init-decls-escape-v.md). DXC (checked with DXC 1.9 through `slangc -pass-through dxc -Xdxc -HV -Xdxc <ver>`) has no FXC-style leak at `-HV` 2016, 2018 or 2021: a read after the loop is "use of undeclared identifier", and the name binds to the outer or global declaration [DXC corpus drill and DXC facts](../learnings/1793409018009-frontend-scoping-prs-drill-dxc-s-own-hlsl-test-cor.md).

The maintainer (tangent-vector) chose to drop the quirk and implement standard C++/DXC scoping, while acknowledging it is "technically a breaking change" for HLSL-mode users whose code was never updated for DXC: "If the authors of FXC already moved on, I think we can too" (#14099, comment 6535132734). The triage had recommended the non-breaking workaround, and the fixer had already implemented and tested it before the maintainer overrode it, which cost a re-plan. For an HLSL-mode bug caused by deliberate FXC-compat legacy behavior, present the DXC-semantics fix (labelled `pr: breaking change`) as a first-class candidate and cite this precedent; the maintainer still decides per issue [tangent-vector prefers modern DXC semantics over FXC-compat workarounds](../learnings/1793400603875-slang-hlsl-mode-tangent-vector-prefers-modern-dxc-.md). The general HLSL-dialect gating rule is on [Compiler triage and tooling](../concepts/agent-routing-f0909b0-compiler-triage-and-tooling.md).

## Reviewing a scoping change: two drills

**Instrument the lookup skip.** A passing suite does not show that nothing else changed binding, because a rebind can pass silently. In a separate worktree (about 10 minutes of build time): (1) add a global `HashSet<Decl*>` of the decls that only the NEW rule hides; (2) in `_lookUpDirectAndTransparentMembers`, where `_isUncheckedLocalVar` skips a member, append `file:line name` to the file named by `getenv("SLANG_DRILL_LOG")`, logging only decls in the set whose check state is neither Unchecked nor being checked (hidden purely by the flag); (3) run the full suite with the variable set, then `slang-test -test-dir docs/generated/tests`. On #14119 the log named only the PR's own tests, which proved no existing test was rebound [instrument the lookup skip](../learnings/1793416991584-slang-scoping-change-review-instrument-the-lookup-.md).

**Diff over DXC's own HLSL corpus.** For a PR that changes how HLSL source is parsed or scoped (PR #14115), sparse-clone microsoft/DirectXShaderCompiler (`git clone --depth 1 --filter=blob:none --sparse`, then `sparse-checkout set tools/clang/test/HLSLFileCheck tools/clang/test/CodeGenSPIRV`), run each file through `slangc -lang hlsl <file> -no-codegen` on the base and head builds, and diff the diagnostic codes. It also covers D3D-only tests under `tests/` that the Linux suite skips. Two traps each looked like an "all SAME" result: `slangc file.slang -lang hlsl` parses the file as Slang with no warning (`-lang` applies only to later files; an HLSL-mode test needs `SIMPLE_EX` with `-lang hlsl` before the path [-lang hlsl applies only to later files](../learnings/1793398431165-slang-tests-lang-hlsl-applies-only-to-later-files-.md)), and relative paths after a `cd` into each file's directory return E00001 for every file. Sanity-check the distribution of codes before trusting a 0-diff [drill DXC's own HLSL test corpus](../learnings/1793409018009-frontend-scoping-prs-drill-dxc-s-own-hlsl-test-cor.md).

A "cpu/vk/cuda" claim for a scoping test can be true without a `-cuda` directive: slang-test synthesizes a `syn (cuda)` row from a `-cpu` COMPARE_COMPUTE line [#14119](../learnings/1793416991584-slang-scoping-change-review-instrument-the-lookup-.md).

## Tooling notes from this cluster

- DXC oracle on Linux: `slangc -pass-through dxc x.hlsl -target dxil -entry main -profile ps_6_0 -o x.dxil` works with a build that has `libdxcompiler.so` in `build/Release/lib`; add `-Xdxc -HV -Xdxc <ver>` for a language version. A working DXC on this fleet is at `wt-13546-verify/build/Release` (set `LD_LIBRARY_PATH` to its `lib`) [#14099](../learnings/1793391200596-slang-hlsl-unscopedforstmt-for-init-decls-escape-v.md), [DXC corpus drill](../learnings/1793409018009-frontend-scoping-prs-drill-dxc-s-own-hlsl-test-cor.md).
- HLSL-mode tests for this cluster: `//DIAGNOSTIC_TEST:SIMPLE(diag=CHECK):-lang hlsl` runs `slangc <file> ... -lang hlsl`, so the file is parsed as Slang (no `UnscopedForStmt`) and checks the wrong language; use `//DIAGNOSTIC_TEST:SIMPLE_EX(diag=CHECK): -lang hlsl tests/path/file.slang`, or `-source-language hlsl` for render-test (`COMPARE_COMPUTE`). Name the test `.slang`, because `/tests/**/*.hlsl` is gitignored. COMPARE_COMPUTE compares stderr, so a new warning fails a runtime test: add `-xslang -warnings-disable -xslang <code>` there and cover the warning in an exhaustive DIAGNOSTIC_TEST [-lang hlsl applies only to later files](../learnings/1793398431165-slang-tests-lang-hlsl-applies-only-to-later-files-.md).
- slang-test can run against a temporary root without touching a shared checkout: `mkdir -p /tmp/x/tests; cp t.slang /tmp/x/tests/; cd /tmp/x; <build>/bin/slang-test -bindir <build>/bin/ tests/t.slang`; the actual output lands in `tests/t.slang.actual.txt` [#14118](../learnings/1793407983707-slang-local-declared-as-unbraced-if-else-while-do-.md).
- In a fresh worktree off the shared checkout, `git -c protocol.file.allow=always submodule update --init --recursive`; a plain update fails with "transport 'file' not allowed". The render-test target is `render-test`, not `render-test-tool` [#14120](../learnings/1793415366185-slang-checker-forward-reference-hiding-misses-sing.md).
- The `/codex-critique` delivery gate (`/app/hooks/track-critique.sh`) records an OUTPUT_REVIEW verdict only when the first codex call carries `STAGE: OUTPUT_REVIEW` and the skill's verbatim developer-instructions; an ad-hoc codex review counts as zero [#14099](../learnings/1793391200596-slang-hlsl-unscopedforstmt-for-init-decls-escape-v.md).

**Source learnings (8):**
- [Slang HLSL UnscopedForStmt: for-init decls escape visitBlockStmt's hide-until-declared → silent wrong binding](../learnings/1793391200596-slang-hlsl-unscopedforstmt-for-init-decls-escape-v.md) — #14099; sibling loops E39999+E30200; inner `i` bound early; `-pass-through dxc` oracle; critique-gate recording rule
- [Slang: local declared as unbraced if/else/while/do body is visible before its declaration (#14118)](../learnings/1793407983707-slang-local-declared-as-unbraced-if-else-while-do-.md) — direct-child-only hiding; after-statement leak is intended and test-pinned; hiding is the non-breaking fix; slang-test temp root
- [Slang checker: hiddenFromLookup is the ONLY declaration-order guard for function-body locals](../learnings/1793413823898-slang-checker-hiddenfromlookup-is-the-only-declara.md) — `ReadyForParserLookup` never unchecked; PR #14119 hides every owned VarDecl; do-while order swap; `$for`/foreach lack DeclStmt
- [Slang checker: forward-reference hiding misses single-statement blocks, __target_switch cases, unbraced catch/$for (#14120)](../learnings/1793415366185-slang-checker-forward-reference-hiding-misses-sing.md) — non-SeqStmt body hides nothing; TargetCaseStmt drops its ScopeDecl; reads 0 on cpu/CUDA; submodule protocol tip
- [Slang scoping-change review: instrument the lookup skip to prove no other test changes binding](../learnings/1793416991584-slang-scoping-change-review-instrument-the-lookup-.md) — SLANG_DRILL_LOG in `_lookUpDirectAndTransparentMembers`; `if let` bare SeqStmt; DebugLexicalBlock CHECK update; `syn (cuda)` rows
- [Frontend-scoping PRs: drill DXC's own HLSL test corpus, and slangc -lang applies only to files after it](../learnings/1793409018009-frontend-scoping-prs-drill-dxc-s-own-hlsl-test-cor.md) — sparse DXC clone; base-vs-head diagnostic diff; absolute paths; DXC has no for-loop leak at any `-HV`
- [Slang HLSL mode: tangent-vector prefers modern DXC semantics over FXC-compat workarounds](../learnings/1793400603875-slang-hlsl-mode-tangent-vector-prefers-modern-dxc-.md) — #14099 maintainer override of the non-breaking option; present the breaking DXC fix as a first-class candidate
- [Slang tests: -lang hlsl applies only to later files; tests/**/*.hlsl is gitignored](../learnings/1793398431165-slang-tests-lang-hlsl-applies-only-to-later-files-.md) — HLSL-mode tests for #14099 need SIMPLE_EX with `-lang hlsl` first, or `-source-language hlsl` for render-test

_Catalog: [[wiki/index.md]]_
