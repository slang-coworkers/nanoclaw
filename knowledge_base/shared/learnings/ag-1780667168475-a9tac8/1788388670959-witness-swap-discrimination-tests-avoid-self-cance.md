---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788382856199-qwatr3
written_at: 2026-09-02T22:37:50.960Z
---

# Witness-swap discrimination tests: avoid self-cancelling / invariant inputs; CPU can't guard a matrix rcp override

## Context
When a Slang interface conformance forwards each requirement to a free math function (e.g. `IReal` witnesses forwarding to `pow`/`exp`/`log`/`saturate`/`rcp`), the realistic bug class is a **copy-paste witness swap** (e.g. `exp` wired to `log`) or a **no-op/identity** witness. A regression test is only useful against that class if a swap/no-op changes the observed output. Several natural-looking test inputs FAIL to discriminate and give false confidence:

- **`exp(log(x)) == x`** — composing inverse functions is invariant under swapping the two *and* under making both the identity. Test each in isolation with distinct expected values: `applyExp(0)→1`, `applyLog(1)→0`.
- **Sum-invariant `saturate` inputs** — inputs like `(-1, 0.5, 2)` chosen so the clamp-off amounts cancel in the sum: an identity (no-op) `saturate` yields the *same* sum. Check individual components, or pick inputs whose clamp does not cancel.
- **Odd/zero-crossing functions evaluated at 0** — `sin(0)+tan(0)=0` holds for `sin↔tan` swapped or either wired to identity (any `f(0)=0`). Evaluate at a nonzero point (with `-output-using-type` tolerance).

Rule: for a discrimination test, ask "does a wrong/identity witness produce a DIFFERENT number here?" If not, the check proves nothing.

## Matrix rcp override cannot be validated on CPU
A `matrix` `rcp()` override that replaces the broad-tier default `This(1.0).div(this)` with a row-by-row reciprocal produces the **same numeric result** as the default on `-cpu` — so a CPU COMPARE_COMPUTE test passes whether or not the override is used. The override's whole purpose is avoiding matrix/matrix division on Metal/WGSL, so its ONLY real guard is a **compile-only cross-target test** (`-target metal`/`-target wgsl`, no GPU needed). And that guard must assert the *specific bad lowering is absent* (e.g. a `METAL-NOT:`/`WGSL-NOT:` on the matrix-division form), not merely that `computeMain` appears in the output — "output exists" only catches the regression if slangc itself errors on the bad form rather than emitting it and deferring rejection downstream. A guard that only checks presence-of-entry-point silently passes a reintroduced matrix/matrix division.

## Reflection name-change framing
Renaming a public interface with a back-compat `typealias` (e.g. `typealias IFloat = IFloatingPoint`) is source-compatible and ABI-safe, but reflection resolves the alias and reports the **canonical** name — so `getTypeFullName()`-string consumers that matched `"IFloat"` silently stop matching. Frame this as a maintainer **label decision** (keep `pr: non-breaking` vs relabel), not a code defect — it's an intentional, documentable surface change. (A generic reviewer bot may over-escalate it to "Bug".)
