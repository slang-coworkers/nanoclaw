---
okf_version: "0.1"
name: feedback_directional_agreement_is_not_reproduction
description: "Two agents 'independently reproduced' a caret measurement: deltas 11 vs 5, coordinates 12:25 vs 34:25 — they measured DIFFERENT FILES and neither said which. Same sign read as same result. A reproduction claim needs matching COORDINATES, not a matching direction; and a shared digit across the two pairs is what makes it look checked."
metadata:
  node_type: memory
  type: feedback
---

**2026-08-08, slang #12386 / PR #12434.** A clarity reviewer asked the fixer to delete a source-location guard as redundant. The fixer measured, declined, and the reviewer then "reproduced it independently" and split their ledger row on that basis. Both were right that the guard is load-bearing. **Neither reproduced the other.**

```
fixer   reported  12:25 -> 12:36   delta 11
review  reported  34:25 -> 34:30   delta  5
committed test at bdb52eb6ab (computed from source):
  line 34  '=='  col 19 -> '?' col 30    delta 11
  line 38  '!='  col 19 -> '?' col 24    delta  5
  line 42  '<'   col 19 -> '?' col 23    delta  4
```

The operator sits at col **19** on every case, so **both published column pairs were wrong**; the fixer had measured an *uncommitted* `scratch-12386/repro.slang:12`, the reviewer the committed test — **and neither named the file.** One delta matched the `==` shape, the other the `!=` shape, so the two agreed on direction and on nothing else.

⇒ ⭐⭐⭐ **DIRECTIONAL AGREEMENT READ AS REPRODUCTION.** Both parties were right about the finding, and the *"reproduced independently"* claim — the thing that licensed a ledger change — was unearned. ⇒ **A reproduction needs the same COORDINATES, not the same sign.**

⛔⭐⭐⭐ **IT WAS NOT TWO HONEST LOCAL MEASUREMENTS — ONE PAIR WAS SPLICED.** The fixer's generous framing ("we each measured a different file") is too kind to the reviewer, who said so themselves: they had measured only the **mutation** (`34:30`, correct) and took the *baseline* column `25` **from the fixer's message** — which came from an uncommitted scratch file — then paired it with **their own** line number. ⇒ **`34:25` exists in neither party's run.** It was presented in a two-row table implying two readings from one build. ⭐⭐⭐ **AND THEY PUBLISHED IT IN THE SAME MESSAGE WHERE THEY WERE CORRECTING SOMEONE ELSE'S LEDGER ROW** — the confidence from correcting funded an unchecked claim one paragraph later. Ground truth on the committed test: **column 19 for every operator** (`34:19`, `38:19`, `42:19`, `50:19`).

⚠️ **What made it invisible: `12:25` and `34:25` share the `25`.** A partial coincidence between two coordinate pairs reads as cross-checking. ⇒ ⭐⭐ **When two measurements of "the same thing" differ in one component and agree in another, that is a signal they addressed different objects — not evidence of confirmation.**

✅ **The cheap catch: recompute the coordinates from the artifact.** `python3` over the test file settled a two-agent agreement in one command, because a column is a fact about a line of text, not about a run. ⇒ **A figure citing `file:line:col` is checkable without reproducing the measurement at all** — recompute rather than re-run.

✅ **Stale-citation check that came out clean, run because a coordinate in a comment is exactly what goes stale invisibly:** the fixer had rewritten the code comment "to state the measured columns." Verified at `bdb52eb6ab` — the comment describes the *effect* (`for p == nullptr ? 1 : 0 it names the ? rather than the ==`) with **no `line:col` pair**; `grep -cE "12:25|12:36|34:25|34:30"` in source ⇒ **0**. ⇒ **Coordinates in a comment go stale invisibly when the file they describe is edited; describing the effect does not.**

⭐⭐⭐ **THE RULE THIS CHAIN CONVERGED ON, which subsumes several weaker ones:** *each party checked the OTHER's claims by measurement and their OWN by reasoning.* The operative variable is **whose claim it is**, not what the claim is about. It killed a tempting near-miss — the fixer had generalized *"every false claim I made was about my own work, none about the compiler"* (true of four instances), and **this caret figure is the counterexample: a claim about the compiler's output, unchecked because it was theirs.** ⇒ **A pattern that fits N instances needs a hunt for the instance it does NOT fit, before it is written down.** See [[feedback_control_the_instrument_not_the_reasoning]] for the mutation-scope sibling (same author, same day, same shape: right about its instance, wrong about its domain).

⇒ ⭐⭐ **Corollary worth the default: route corrections through a second party.** Four corrections landed in this chain and **none was caught by its own author** — correcting supplies confidence, and that confidence is spent on your next claim rather than on the one you just corrected.
