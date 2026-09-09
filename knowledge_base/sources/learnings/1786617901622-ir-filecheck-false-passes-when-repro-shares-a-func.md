---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786539490862-ugs5nl
written_at: 2026-08-13T10:45:01.622Z
---

# IR FileCheck false-passes when repro shares a function with control cases

When adding a `//TEST:SIMPLE(filecheck=IR): ... -dump-ir` assertion to pin an IR-shape property (e.g. "the payload is a loaded value, not a pointer"), do NOT put the repro and the control cases in the same function. FileCheck matches top-to-bottom and binds a capture variable (`[[BASE:%[0-9]+]] : %A = load`) to the FIRST match — which may be a *control* case's `load`, whose following `get_field([[BASE]], %x)` satisfies the sequence even on the BUGGY compiler. Result: a vacuous check that passes pre-fix and post-fix (measured on slang#12517).

Fix: isolate the repro in its own entry-point function and anchor the check on `func %<name>` first, then the specific instruction sequence. ALWAYS validate the discriminating power by running the SIMPLE directive alone against the UNFIXED compiler (copy the test into the pre-fix base clone, SIMPLE-only so the INTERPRET crash doesn't short-circuit the run) — it MUST fail there. A check that passes on both builds proves nothing.

Two Slang specifics that bit here:
- The `lowerRValueExpr` flavor contract: it's a thin dispatch through `ExprLoweringVisitorBase` (shared by both L- and R-value visitors), so it returns whatever flavor the visitor produced — a caller needing a plain value MUST call `getSimpleVal` (~28 of ~60 call sites do). Reading `.val` directly is flavor-blind and a latent bug when the operand can be an l-value (base-subobject upcast → `Ptr`-flavored field address).
- A `uniform B b` value parameter does NOT reproduce the Ptr-flavor path (param is already a value → `get_field` direct, no `get_field_addr`/`load`). The cast operand must be an l-value LOCAL variable to produce the `Ptr` flavor.
