---
name: feedback_a_delta_keyed_gate_misses_substitutions
description: "A ratchet/baseline gate keyed on a COUNT nets a fix and a new fault to zero. Measured on nanoclaw#1133: fix the baselined error + add a same-code error in the same file → RC=0 'no drift'; control (skip the fix) → RC=1. Test a gate with a SUBSTITUTION, not just an addition."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 6068983b-b2fd-4e0b-b361-04a0a58b0a31
---

# A gate keyed on a count cannot see a substitution

Measured 2026-08-06 on `slang-coworkers/nanoclaw#1133` (typecheck ratchet, `scripts/typecheck-gate.mjs`).
The gate keys each error as `file + TScode + count` and compares against a checked-in baseline. Its
author tested it thoroughly — four exit paths, all firing, all verified by me too — but every test was
an **addition** or a **removal**, never a **swap**.

Because the key is a count, one fix and one new fault of the same code in the same file **net to
zero**:

1. Fix the baselined `setup/index.ts TS2307 x1` (create the missing `./groups.ts`) — alone this gives
   `RC=1` *"1 baselined entry no longer occurs"*, raw tsc shows 0 diagnostics for that file.
2. Add one new bad import to the same file: `zznew: () => import('./zz-nope.js')`. Raw tsc reports
   `setup/index.ts(22,23): error TS2307`.
3. Gate verdict: **`RC=0` — "16 diagnostic(s), 12 baselined, no drift."**

**Control** (skip step 1, add only the bad import): `RC=1`, `TS2307 now x2, baseline x1`. So the key
design is the cause; the instrument is alive.

## The rule

⭐⭐⭐ **Any gate that compares a CURRENT measurement to a STORED one must be tested with a
substitution, not only an addition and a removal.** Addition and removal are the two tests that
occur to you naturally, and both pass on a defective key. The question to ask of any baseline /
snapshot / count / diff gate: *can two changes of opposite sign in one bucket cancel?* If the key is
coarser than the thing it guards (count vs identity, file vs line, name vs content), yes.

⭐⭐ **The reachability argument matters more than the mechanism.** This isn't exotic: the file with
baselined entries is exactly the file someone edits when paying the debt down. And the
**prune signal is what cancels the new error** — the mechanism added to keep the baseline honest is
what launders the regression.

## Corollary — my own proposed fix broke the happy path, and that was the finding

My first fix keyed on the **message text**. It caught the substitution, but the untouched tree went
`RC=1` — `parseBaseline` splits on `/\s+/`, so a message containing spaces cannot round-trip through
the baseline file. A **message digest** (`sha1(msg).slice(0,8)` as a 4th column) round-trips and was
validated on four cases: happy path `RC=0`, substitution `RC=1`, plain new error `RC=1`, prune `RC=1`.

⇒ ⭐⭐⭐ **Run your proposed fix against the HAPPY PATH before proposing it.** A fix validated only
on the failing case is half-tested, and a reviewer shipping a fix that reddens a clean tree burns
more credibility than the finding earns. Same lesson as nanoclaw#1103, where the author's own
unattributed-consumption branch beat my proposal for exactly this reason.

See also [[feedback_a_green_checker_that_excludes_the_changed_file]] (the sibling question: not
"is the key right?" but "is the FILE in the program?"), and
[[feedback_a_guard_can_be_inert_and_read_as_passing]].
