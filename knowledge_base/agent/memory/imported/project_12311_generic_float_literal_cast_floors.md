---
name: project-12311-generic-float-literal-cast-floors
description: "#12311 (T)0.25 in T:IArithmetic generic floors to 0 (IArithmetic lacks __init(float)). TERMINAL: closed 2026-09-11 by jkwak-work as a known design limitation (fix path = experimental slang.numerics; user workaround = extension __init(float) or E30081-as-error). PR #12312 (bare requirement) rejected/closed — a non-[sealed] interface admits the open user-conformer set."
metadata: 
  node_type: memory
  type: project
  originSessionId: 5fa1a76c-57e3-4577-b9b3-3bf709556acd
---

# shader-slang/slang #12311 — casting a float literal via generics floors the value

**Reporter:** Tabris05. Filed/triaged 2026-08-01, bug / high / P1 / frontend.
**State: TERMINAL — issue closed 2026-09-11T20:35Z (completed, label `reproduced`); PR #12312 closed
unmerged 20:37Z.** RE-OPEN only on a fresh substantive question the workaround doesn't cover.

```slang
T oneQuarter<T : IArithmetic>() { return (T)0.25; }
// black_box[0] = (float)0.25;        -> 0.25
// black_box[1] = oneQuarter<float>(); -> 0     (warning E30081 only)
```

## Root cause (confirmed by maintainer)

`IArithmetic` (`core.meta.slang`) declares `__init(int)` / `__init(This)` but no `__init(float)`, so
`(T)0.25` binds to `__init(int)` **at generic-check time**, before `T=float` is known. ⭐ The *why* posted
to the reporter (cmt 5643547971): Slang checks a generic body once against the constraint's requirement
set, then at specialization routes the call through `float`'s witness for the `__init(int)` requirement —
float's own float ctor never re-enters overload resolution. `ITexelElement` hits the same bug (worse:
no diagnostic) because `associatedtype Element : __BuiltinArithmeticType`, which derives `IArithmetic`.

## History in one paragraph

Draft PR #12312 added a bare `__init(float)` requirement to `IArithmetic`; review was APPROVE-WITH-NITS
and an 08-10 differential matrix showed it transitively fixed `IArithmetic`, `ITexelElement` and
`IInteger` (one residual: `ICoopElement`, which doesn't derive `IArithmetic`, still floored silently).
On 2026-09-11 tangent-vector **rejected the approach** (PR cmt 5639073499): `IArithmetic`/`IFloat` are
non-`[sealed]`, so a new requirement synthesizes via `__init(int)` for any *user* conformer without a
float init and silently truncates there — trading one silent wrong result for another. jkwak-work then
closed the issue (cmt 5640322596) as a **design-level limitation**: long-term fix is the experimental
`slang.numerics` module; short-term, the user adds `extension<T> T : IArithmetic { __init(float val); }`
or treats `warning E30081` as an error. No in-repo change owed; fixer stood down.

## ⭐⭐⭐ Durable lessons

- **Measured the right cells over the wrong population.** Our "non-breaking" check covered only
  core-module conformers; a non-`[sealed]` interface admits an open user-conformer set, so an in-tree
  check cannot clear a requirement addition — and the `MyNumber` user type we cited as proof of
  non-breaking *was* the footgun. For this class prefer a **diagnosing extension** over a new requirement.
- The `ICoopElement` residual (fix cannot reach a conformer without a value-preserving float init) was
  the maintainer's objection in miniature, sitting in our own matrix. A residual that the fix "can't
  reach" is worth asking *who else it can't reach*.
- Per-cell runs: a combined slangi run aborted on the `IInteger` E39999 cell; run differential matrices
  one cell per invocation.
- Line numbers Main quoted were master-based, −4 vs the PR head; the hedge "re-derive on your worktree"
  let the triager catch it cheaply — cf. [[feedback_line_numbers_shift_in_the_patched_tree]].
