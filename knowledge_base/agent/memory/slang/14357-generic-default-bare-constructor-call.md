---
type: chain
title: slang#14357 — generic struct with all-default params accepts `Foo foo;` but rejects bare `Foo(42u)` (E39999)
description: Human (tdavidovicNV, MEMBER) 11-05 18:16Z. TRIAGED 18:29Z enhancement/low/P3 (cmt 6665924893). PARKED on a language-design decision (csyonghe, Q1-Q3); no fixer.
resource: raw/triage-14357.md
tags: [parked, generics, default-generic-args, constructor, overload-resolution, consistency]
---

# slang#14357 — default generic args vs. bare constructor call

- **Filed** 2026-11-05 18:16:57Z by tdavidovicNV (author_association MEMBER). At dispatch it had no assignees, labels, events or comments, and `grep -rl 14357 memory/slang/` had no hits.
- **Reporter's claim (not verified by me):** `struct Foo<T = uint>`: `Foo foo;` and `Foo<>(42u)` compile, but `Foo(42u)`, `Foo()` and `(Foo)42u` fail with E39999 "could not specialize generic for arguments of type (uint)". A concrete `typealias` works. The reporter points at `inferGenericArguments` (`slang-check-overload.cpp`), which handles only a `CallableDecl` inner decl, against `CoerceToProperTypeImpl` (`slang-check-type.cpp`), which applies defaults. Related: #10836 (default args in function inference), #10538 (generic constructors).
- **Dispatched** 18:2xZ to slang-triager on `gh-issue-shader-slang/slang-14357`.
- **Triage** posted 18:29Z by nv-slang-bot (cmt 6665924893), with label `reproduced`; Issue Type left blank. Repro on master 4a6758601: all 11 rows behave as reported. 2026.13.1 fails the same way, so it is not a regression. No duplicate issue and no open PR. #10538 was closed unmerged.
- **Root cause (I verified the branch at 4a6758601):** in `inferGenericArguments` (`slang-check-overload.cpp:3038-3042`), the `else` that handles a non-`CallableDecl` inner decl (`// TODO(tfoley): any other cases needed here?`) returns before `trySolveGenericArguments`. That function is the only place a call applies defaults. Separately, constructors are looked up only on an already-specialized type, so nothing infers a struct's params from `__init` args.
  - Triager-reported, not re-verified: `(Foo)42u` fails because `visitTypeCastExpr` (`slang-check-expr.cpp:7766`) keeps the bare callee.
- **Options:**
  - **A** — defaults only (~10 lines).
  - **B** — infer the struct's params from `__init` args, then use defaults, the rule generic functions follow. The triager's lean.
  - **C** — keep rejecting; add a focused diagnostic and docs.
  - Shipping A and then B would silently change `Inferred(42u)` from `Inferred<float>` to `Inferred<uint>`.
- **State: PARKED** on csyonghe (or another language maintainer) answering Q1-Q3 on the issue. Fixer dispatch is an operator decision. Triager one-shot re-check `t-8ebc58` runs 2026-11-12 18:00Z (triager-reported; it is in the triager's group). I cancelled my duplicate `i14357-recheck-ce3b`.
