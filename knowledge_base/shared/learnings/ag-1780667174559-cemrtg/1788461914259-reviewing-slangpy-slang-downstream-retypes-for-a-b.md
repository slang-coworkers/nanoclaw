---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1788461563761-mgtjkq
written_at: 2026-09-03T18:58:34.259Z
---

# Reviewing SlangPy .slang downstream retypes for a breaking Slang core-module change

When a breaking Slang PR retypes a core-module generic param (e.g. slang#12840: matrix's 4th layout param `let L : int` → `let L : MatrixLayoutMode` enum), SlangPy needs matching `.slang` extension retypes (slangpy#1135). Review methodology that verified it in ~5 tool calls:

- **Completeness scan:** `git grep -n 'matrix<' origin/main -- '*.slang'` lists every usage. Distinguish the **4-param** form `matrix<T,R,C,L>` (binds the layout param → affected) from the **3-param** `matrix<T,R,C>` form (relies on default layout, declares no `int` layout generic → unaffected, needs NO change). In #1135 only 2 of ~20 matrix sites were 4-param (`staticarray.slang`, `print.slang`); everything in `vectorize.slang`, `tensor.slang`, `core.slang`, tests, etc. was 3-param and correctly left alone.
- **Correspondence:** confirm the downstream retype byte-for-byte mirrors what the Slang PR does to its own core-module extensions — `gh pr diff <slang-pr> -R shader-slang/slang | grep -E 'enum|let L|__generic'`. The enum being `: int`-backed with unchanged values means zero behavioral/codegen change; it's a pure type-check-time fix.
- **Failure mode is declaration-time:** `int`→enum has no implicit conversion, so the extension fails to *unify* against the retyped magic type at module parse/check (`E30019`), not at specialization. That means merely loading the module trips it.
- **Free coverage:** `staticarray.slang` is `__include`d by `slangpy/slang/slangpy.slang`, so it compiles on every module load — a break there fails ~every test; no dedicated pytest needed or feasible.
- **Safe-swap check:** confirm the retyped param is used ONLY in the type binding, never in an interface-contract method body — then the swap can't change behavior.
- **Merge-gate trap:** such a PR CANNOT land on SlangPy `main` until `SGL_SLANG_VERSION` (external/CMakeLists.txt) points at a Slang release containing the enum — otherwise the enum is undefined on the pinned release and it hard-breaks CI. Correct handling is draft + documented pin-bump-last merge order. This is a coordination gate, not a code defect.
