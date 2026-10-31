---
type: triage
description: HLSL-mode sibling `for (int i…)` loops fail E30200/E39999 — FXC leak (UnscopedForStmt) without FXC's redeclaration rule. Not a regression.
---
# Triage: shader-slang/slang#14099 — HLSL: sibling for loops with the same initializer variable fail with conflicting declarations
Date: 2026-10-30T19:57Z | bug | high (silent wrong code in a related shape) | P2 | frontend (parser + semantic checker)

## What's broken
In HLSL mode (`-lang hlsl` or `.hlsl`), two sibling `for (int i = …)` loops in one block fail with
E39999 "ambiguous reference to 'i'" (x6) + E30200 "conflicting declaration" (x1). `.slang` input compiles.
Reporter: pdeayton-nv (MEMBER; assigned by jhelferty-nv 10 s after filing; `bot-ok`).

## Repro (facts, measured 2026-10-30)
`slangc -lang hlsl repro.hlsl -target hlsl -entry main -stage fragment -o out.hlsl` (repro in issue body).
| build | repro.hlsl | repro.slang |
|---|---|---|
| near-tip 2026.20-97-ge961f2162 (wt-14065; tip d34a5eb54 is 5 commits ahead, none touch parser/check/lookup) | FAIL E30200 + 6×E39999 | OK |
| v2026.10, v2025.18.2 releases | FAIL (same) | — |
DXC 1.9 (`slangc -pass-through dxc … -profile ps_6_0`): repro ACCEPTED.
Shape table (HLSL mode / .slang / DXC 1.9):
- `for(int i){}; return i;` (use after loop): OK / E30015 / **DXC error** "use of undeclared identifier 'i'"
- `for(int i){}; int i = 5;`: E30200+E39999 / OK / OK
- `int i = 5; for(int i){}`: E30200+E39999 / OK / OK
- sibling loops, different names: OK / OK / OK
- `value = i; for(int i){}` (use before loop): **OK (rc=0, hole)** / — / —
- `int i = 7; { value = i; for (int i…){} }`: **SILENT MISCOMPILE** — `value = i` binds the not-yet-declared inner
  for-init `i` (HLSL out: global `int i_0;` read; SPIR-V: OpLoad of uninit Function var `%i_0`) / — / DXC OK (outer i=7)
Not a regression: fails back to v2025.18.2; the leak is by design since a40b66799 (Tim Foley, 2017-07-08,
"Differentiate HLSL `for` loops in AST").

## Codebase digest (origin/master d34a5eb54)
- `slang-parser.cpp:7792-7855` `ParseForStatement`: `brokenScoping = HLSL` → `UnscopedForStmt`, and
  `if (!brokenScoping) pushScopeAndSetParent/PopScope` is skipped, so the init `VarDecl` becomes a member of the
  ENCLOSING block's `ScopeDecl` (FXC legacy leak; comment "we want to respect that").
- `slang-ast-stmt.h:228` `UnscopedForStmt : ForStmt` (empty). Other uses: `slang-lower-to-ir.cpp:9698`
  (`maybeEmitDebugLexicalBlock` skips it; #13219 by the reporter), `slang.natvis:277`. Checker `visitForStmt`
  (`slang-check-stmt.cpp:317`) treats both kinds identically.
- E30200: `checkForRedeclaration` (`slang-check-decl.cpp:14918`) walks `parentDecl->getPrevDirectMemberDeclWithSameName`;
  `checkRedeclaration` (:14837) only tolerates funcs / module decl / unscoped-enum alias — two `VarDecl`s in one
  `ScopeDecl` always error. No HLSL/for-init exemption.
- E39999: lookup is not source-ordered. `_isUncheckedLocalVar` (`slang-lookup.cpp:174`) skips locals that are
  Unchecked / being checked / `hiddenFromLookup`. `visitBlockStmt` (`slang-check-stmt.cpp:128-145`) sets
  `hiddenFromLookup` only on DIRECT `DeclStmt` children of the block's `SeqStmt`; reveal at :87 (decl point).
  The for-init `DeclStmt` is nested in the `ForStmt`, so loop 2's `i` is never hidden → visible while loop 1 is
  checked (the note lists it as untyped `i`). Body-stage parse marks locals `ReadyForParserLookup`
  (`slang-parser.cpp:6171`), so they are not "Unchecked" either.
- Lookup across scopes stops at the innermost scope with a non-overloadable hit (DeepWiki; `_lookUpInScopes`),
  so a per-loop ScopeDecl would shadow correctly.
- Tests: only `tests/spirv/debug-lexical-scope-unscoped-for.slang` (-lang hlsl, uses `i` AFTER the loop — added
  by the reporter in #13219, 2026-10-02) exercises the leak. No HLSL test with two sibling loops.
- FXC (documented, not run here — Windows-only): leaks the loop var and accepts a redeclared loop variable with
  warning X3078 "loop control variable conflicts with a previous declaration in the outer scope; most recent
  declaration will be used". Slang implements the leak but not this rule — that is the gap.

## Candidate approaches
### A: FXC "most recent declaration wins" in the checker (keep the leak) — RECOMMENDED
- Where: `slang-check-stmt.cpp:128-145` (+ :87), `slang-check-decl.cpp:14837/14918`; maybe a parser marker on
  for-init decls at `slang-parser.cpp:7826`.
- Delta: (1) hide every local var the block's `ScopeDecl` owns until its decl point, not only direct-child
  `DeclStmt`s (catches for-init decls, incl. `if (c) for (int i…)` without braces) — fixes loop 1 seeing loop 2's `i`;
  (2) when a same-scope redeclaration is revealed and EITHER the old or new decl is an `UnscopedForStmt` init, hide
  the earlier one (superseded) — covers sibling loops, for-then-`int i`, `int i`-then-for, and both branches of an
  unbraced `if`; only same-scope decls (inner blocks already shadow via lookup's innermost-hit stop);
  (3) `checkRedeclaration` accepts exactly those pairs; ordinary `int i; int i;` stays E30200.
  Hide = decls OWNED by the block's ScopeDecl (not a recursive AST walk); audit catch `errorVar` (:712) and
  cbuffer transparent members.
- Tradeoffs: keeps the leak (no breaking change for FXC code); #13219's use-after-loop test keeps passing. Side effect of (1):
  `value = i; for (int i…)` (use BEFORE the loop) compiles today (measured, rc=0) and would now error — a fix; the nested miscompile shape now reads the outer `i` (meaning CHANGES, to the correct one). Medium complexity; reuses `hiddenFromLookup` for "superseded".
- Risk: `int i = 5; for (int i…){}; use(i)` gets FXC meaning (loop var) where DXC means the outer `i` → silent
  divergence; emit an X3078-style warning ONLY for that shape (not for sibling for-inits, which DXC accepts
  silently). 
### B: C++/DXC scoping for HLSL `for` (drop the leak)
- Where: `slang-parser.cpp:7801-7851` (remove `brokenScoping`); `UnscopedForStmt` + `lower-to-ir.cpp:9698`
  become dead → delete; rewrite `tests/spirv/debug-lexical-scope-unscoped-for.slang`.
- Delta: exact DXC 1.9 behaviour on all four shapes; use-after-loop becomes E30015.
- Tradeoffs: smallest diff, removes code. BREAKING for FXC-era shaders that read the loop var after the loop
  (`pr: breaking change`); reverses a deliberate 2017 design and the reporter's own 3-week-old test → maintainer call.
### C: per-loop scope + post-loop fallback lookup (hybrid)
- Where: parser pushes the for scope in HLSL too; `slang-lookup.cpp` `_lookUpInScopes` gains a fallback: a miss
  in a block scope consults preceding `UnscopedForStmt` scopes of that block (latest first), optionally warning.
- Delta: DXC semantics inside/around loops; post-loop use still resolves.
- Tradeoffs: most compatible with both compilers, but adds a lookup tier that walks statement structure
  (CLAUDE.md "context rediscovery" smell); highest complexity.
- Risk: language-server/completion and debug-scope (#13219) interplay.
Rejected: diagnostic-only (better E30200 text suggesting braces) — does not fix valid DXC code.

## Recommended path (solution brief)
- Hypothesis: HLSL `UnscopedForStmt` puts each for-init `VarDecl` in the enclosing block `ScopeDecl`; the checker
  has no FXC redeclaration rule and its hide-until-declared logic misses nested for-init decls → E30200 + E39999.
- Approach A (above). Flag: if a maintainer prefers DXC scoping, B is smaller but breaking.
- Files: `source/slang/slang-check-stmt.cpp:87,128-145`; `source/slang/slang-check-decl.cpp:14837,14918`;
  `source/slang/slang-parser.cpp:7792-7855`.
- Repro: `slangc -lang hlsl repro.hlsl -target hlsl -entry main -stage fragment -o out.hlsl`.
- Accept when: repro compiles in HLSL mode with each loop using its own `i` (runtime test, e.g. CPU
  COMPARE_COMPUTE `-lang hlsl`, value == 2); `int i; int i;` in one block still E30200;
  `debug-lexical-scope-unscoped-for.slang` still passes; `.slang` behaviour unchanged; nested shape reads outer `i`
  (runtime value 8); tests for the
  for-then-`int i` and `int i`-then-for shapes with the chosen semantics (+ warning for the DXC-divergent one).

## Sources
- DeepWiki Q1 (UnscopedForStmt / FXC X3078): confirms leak by design, no redeclaration mechanism.
- DeepWiki Q2 (lookup across scopes): innermost non-overloadable hit stops lookup; `hiddenFromLookup` semantics.
- Related, not dup: #13752 (skiminki-nv, shadowing diagnostics, open; PR #14093 generic-param shadowing open),
  #13876/PR #13880 (redeclaration replay; not the cause — explicit `int` was already on the Error path).
- Dedup: `gh issue list` searches (for-loop conflicting/scope/UnscopedForStmt/X3078/leak) + timeline: no PR, no dup.
