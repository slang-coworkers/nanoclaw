---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785559184147-3jb7r3
written_at: 2026-09-11T18:43:34.034Z
---

# Adding a requirement to a NON-sealed interface is breaking even when synthesis keeps in-tree conformers compiling

## TL;DR

I "fixed" slang#12311 (`(T)0.25` floors for `T : IArithmetic`) by adding a bare `__init(float)` **requirement** to `IArithmetic`, and verified it non-breaking: every in-tree conformer + a user `struct MyNumber : IArithmetic` (only `__init(int)`) still compiled, because requirement-synthesis (`trySynthesizeConstructorRequirementWitness`) builds the missing witness from the existing `__init(int)`. Maintainer (tangent-vector) rejected it as breaking anyway — and was right. Two things my green suite structurally could not see:

1. **Non-sealed ⇒ unbounded conformer set.** `IArithmetic`/`IFloat`/`IComparable` are NOT `[sealed]` (only `IArithmeticAtomicable` is). A test suite can only exercise in-tree conformers; user code conforms arbitrary types. "Source-compatible for the conformers exercised here" is the tell that you've proven the wrong theorem — for a non-sealed public interface, adding a requirement is breaking *in principle* regardless of what your suite shows.

2. **Synthesis SUCCEEDING can be worse than it FAILING.** For a user arithmetic type that isn't int-like (fixed-point, rational), synthesizing `__init(float)` through the existing `__init(int)` makes `(T)0.25` **silently truncate to 0** — trading the reported silent-wrong-result for a fresh one in *user* code. A green compile is not evidence of correctness when the synthesized path changes runtime semantics.

## The sounder fix (maintainer's)

Don't add a requirement. Add an `extension<T> where T : IArithmetic { __init(float){...} }` (an extension member is NOT a requirement ⇒ touches no conformance) whose selection **emits a guiding compile error**, so `(T)0.25` fails loudly instead of flooring. Precedent for "diagnose + point to guidance": `[deprecated("… see #<issue>")]` on the `vector<T,4>` three-component initializers in `core.meta.slang`. Strategic home for getting the interfaces *right*: the experimental `slang.numerics` module (`source/standard-modules/numerics/`), where breaking changes are cheap.

## Rule

Before adding/changing a **requirement** on a public interface, first check `[sealed]`. If not sealed, "my tests pass" cannot establish non-breaking — the conformer set is open. Prefer an **extension member that diagnoses** over a new requirement when the goal is to stop a footgun rather than to add capability. And when a fix relies on synthesis/implicit-conversion to keep things compiling, ask what that synthesized path *does at runtime* for out-of-family conformers, not just whether it compiles.
