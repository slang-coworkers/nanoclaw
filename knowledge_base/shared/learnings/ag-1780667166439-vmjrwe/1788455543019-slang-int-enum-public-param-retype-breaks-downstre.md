---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788453082263-8c4qt3
written_at: 2026-09-03T17:12:23.019Z
---

# Slang int→enum public-param retype breaks downstream generic matrix extensions (SlangPy Tests CI)

When a Slang PR retypes a **public** generic value parameter from `int` to an enum (e.g. PR #12840 retyped the built-in `matrix<T,R,C,L>`'s 4th param `L` from `int` → the new `MatrixLayoutMode` enum), any downstream Slang code that declared its own generic extension over that built-in with the old `int` type breaks at **front-end import/type-check**:

```
error[E30019]: type mismatch in expression ... expected an expression of type 'MatrixLayoutMode', got 'int'
note: explicit conversion from 'int' to 'MatrixLayoutMode' is possible
```

Slang does **no implicit int→enum conversion** for generic value arguments, so `let L : int` no longer coerces into the enum-typed slot.

**Where this shows up:** the "SlangPy Tests" check on a slang PR is a `repository_dispatch` (`trigger-slangpy-tests` job) that runs in the **slangpy** repo (`shader-slang/slangpy` Actions), building slangpy's default branch against the PR's Slang via `SGL_LOCAL_SLANG=ON`. Get logs with `gh run view <id> -R shader-slang/slangpy --log-failed`. The failing test cases (device/shader, func/tensor, refl/lookup) all cascade from one `E30019` during `import`.

**Root-cause fast:** the two affected sites in slangpy were declarations forwarding an int into `matrix<...,L>`: `slangpy/slang/staticarray.slang` (`let L : int`) and `src/sgl/device/print.slang` (`__generic<..., let L : int>`). Find all sites: `gh api -X GET search/code -f q='matrix repo:shader-slang/slangpy "let L : int"'`.

**Fix:** retype the downstream param to the enum (`let L : MatrixLayoutMode`) in a **companion slangpy PR**. Ordering wrinkle: the slangpy edit only compiles against a Slang that defines the enum, and the CI check builds slangpy's *default* branch — so the check stays expected-red on the slang PR until slangpy updates (merge the slang PR with the check acknowledged red, then land the slangpy PR). This is a legit `pr: breaking change`; it breaks any external code passing an int (incl. `kRowMajorMatrixLayout`/`kColumnMajorMatrixLayout` `static const int` constants) as the 4th matrix arg.

**Don't conflate** this front-end import break with codegen-time layout concerns (e.g. the column-major-default worry): E30019 stops compilation before specialization/lowering runs.
