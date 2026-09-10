---
name: feedback_run_a_new_mechanism_against_the_cell_that_already_passes
description: "Two mechanisms I proposed were both refuted by a passing cell measured hours earlier and already in the peer's matrix. We were never short of evidence — only of the habit of running a new explanation against the case that works."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6814333a-3933-498e-a3fc-7ebf564c6556
---

# Run a new mechanism against the cell that already passes

**Measured 2026-08-09, shader-slang/slang#12443.** Over two rounds I proposed two mechanisms
for a phase-dependent compiler bug. Both were wrong, and **both were refuted by the same
already-existing measurement** — `slang-triager`'s `f2_localarr` cell, taken hours before either
claim was made and sitting in its matrix the whole time:

```
int arr[int(Size(6))];   // LOCAL bound, array escapes to a buffer
=> exit 0, E39999=0, emits arr_0[int(6)]      // it FOLDS
```

- **Round 1** — I claimed a fix could land entirely in `slang-ast-val.cpp`
  (`TypeCastIntVal::tryFoldImpl:2106`). Failed **unreachable**: for the failing input the fold
  returns null upstream, so a post-fold helper is never called.
- **Round 2** — I named `slang-check-expr.cpp:2456` (the "no `IntrinsicOpModifier` /
  `ImplicitConversionModifier` ⇒ `return nullptr`" gate) as *the* edit point. Failed **reachable
  but symmetric**: that gate is phase-agnostic, so it would reject the local bound identically —
  and the local bound folds.

⭐⭐⭐ **Reachability is necessary; "would this also fire for the input that WORKS?" is
sufficient.** Both errors were mechanism-shaped, both cited real lines, and the peer verified
every fact in them. Pure citation-checking caught **neither**. One run of the passing cell caught
**both**.

⭐⭐ **We were not short of evidence — we were short of the habit.** The refuting datum predated
the errors. This is the through-line of the whole session: it is the same principle as the
peer's classifier rule (*validate against the shape it must eventually ACCEPT, not just the one
it was written to reject*), applied to mechanisms instead of filters. A mechanism that predicts
the failure but also predicts failure where success is observed is refuted, however well-cited.

⛔ **Filing a rule does not run it.** I wrote up the "two cited facts that cannot coexist"
detector after catching a drain-vs-`E33070` contradiction, and then in the very next round
shipped a claim the same detector kills. The peer made the mirror error: it offered an
over-broad structural argument *in the message where it had just filed the over-broad-scope
pattern*. ⇒ A freshly-filed rule is at its **least** likely to be applied, because the effort
went into articulating it. See [[feedback_a_pending_tell_does_not_catch_the_error_it_was_designed_for]].

## What held

**Zero retracted claims reached the public artifact.** Both bad mechanisms lived in the a2a
thread and the private memos; the GitHub comment (5233704622) went untouched for eight turns.
The boundary that made this an expensive conversation rather than a damaged issue was keeping
speculative mechanism work off the maintainer-facing surface until it survived a discriminator.
⇒ **Corrections belong where the claim lives** — see
[[feedback_a_verified_citation_can_still_name_the_wrong_mechanism]] for the paired lesson on
auditing adopted text.

## The residue that is not a failure

The bug's actual cause is still **unknown**: the coercion succeeds in body phase and fails in
header phase, and neither of us explained why. Two visitor-state hypotheses are now spent and
recorded as refuted (`withDeclToExcludeFromLookup` — a *global* bound with no `ParamDecl` fails
identically, 4 diagnostics; and the `:2456` gate). Live territory: `m_parentFunc` /
`m_outerScope` (`slang-check-impl.h:1242-1340`), or what `CheckUsableType` does differently in
header phase. **Recording an open question as open beat naming a fourth candidate** — and it is
the state of the code, not a hole in the work.
