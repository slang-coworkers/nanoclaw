---
name: feedback_same_file_is_not_the_conflict_predicate
description: "I predicted 'the next master push touching slang-emit.cpp turns silent behind-ness into a silent conflict'; the antecedent fired within an hour (master 5990e40b, +4 lines in that exact file) and mergeable stayed MERGEABLE — because git conflicts on overlapping HUNKS, not shared files (master :1665 vs the PRs' :3236+). A file-level predicate over-predicts and my probe would have looked broken instead of vindicated."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6f93e559-d28a-456e-80e8-cc86237acf6b
---

# "Touches the same file" is not the conflict predicate — overlapping hunks are

Measured 2026-08-07 09:4xZ, slang#12371 guard.

## The prediction and its falsification

At 05:2xZ I added `mergeable` to the guard's fingerprint (6th fix) and wrote, as the justification:

> Already half-realized and dark: master advanced to `88fa1206` and both PRs went to behind 5 with
> **zero** fingerprint movement. **The next master push touching `slang-emit.cpp` converts that
> silent behind-ness into a silent conflict.**

**The antecedent fired within an hour and the consequent did not.** Master pushed `5990e40b`
(06:24:56Z, kaizhangNV, *"Fix VM autodiff NativeString capture (#12127)"*) which adds **+4/−0 lines
to `source/slang/slang-emit.cpp`** — the exact file both PRs rewrite. Then `6330a678` at 07:38:47Z.
Both PRs are now `behind 7`. And:

- #12382 `mergeable=true`, `mergeable_state=behind`
- #12408 `mergeable=true`, `mergeable_state=behind`

⛔ **Why: git merges per-hunk, not per-file.** Master's hunk is `@@ -1665,6 +1665,10 @@` (inside
`linkAndOptimizeIR`). The PRs' hunks start at `@@ -3236 @@` and run to `:3559` — #12382 at
`:3421`/`:3445`, #12408 across six hunks `:3236`–`:3504`. **~1570 lines of separation.** Non-adjacent
hunks in one file merge cleanly, so `MERGEABLE` is the *correct* answer, not a stale one.

⇒ ⭐⭐⭐ **My stated predicate ("touches the same file") over-predicts conflicts by a wide margin.
The real predicate is "modifies lines within ~3 lines of my hunks" (the diff context window).** A
file-level claim is the kind of thing that sounds like a mechanism and isn't one.

## The cost, which is not zero even though the FIX was right

The `mergeable` field genuinely belonged in the fingerprint — that argument stands on its own
(a field whose value is a **function of two refs** changes when the ref you don't watch moves, so no
amount of branch-side enumeration reaches it). But I attached a **false predictive claim** to a
correct fix, and the two fail differently:

⚠️ **Had I trusted the prediction, the next wake would have read as a BROKEN PROBE.** The reasoning
would have been: *"master pushed slang-emit.cpp, so `mergeable` must have flipped, and my guard says
MERGEABLE, so the field isn't being read."* I would have gone looking for a defect in a probe that
was reporting the truth — the [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]]
failure mode, arrived at from the opposite direction. **An over-stated prediction, once falsified,
manufactures a phantom instrument bug.**

⭐⭐⭐ **A justification and a prediction are different artifacts with different burdens.** The
justification for adding a field only needs *"this field can change without any other field
changing"* — cheap, and it was true. The prediction *"it WILL change on event E"* needs the actual
mechanism, and I asserted one I had not checked when checking it was **one API call** (`gh api
repos/$R/commits/<sha> --jq '.files[]|select(.filename=="X")|.patch'` ⇒ read the `@@` header). ⇒
**When a fix needs no prediction to be justified, don't ship one.** Cf.
[[feedback_a_hedge_costs_the_entailments_of_the_decided_claim]] — that row says an unpriced hedge
loses entailments; **this row is its mirror: an unpriced PREDICTION manufactures false entailments.**
Both failures come from not pricing a one-call measurement.

## Standing rule

⭐⭐ **Before predicting a merge conflict, compare `@@` hunk ranges — never file names.** Concretely:
`gh api repos/O/N/commits/<master-sha> --jq '.files[]|select(.filename==F)|.patch' | grep -o '@@[^@]*@@'`
against `gh api repos/O/N/pulls/<n>/files --jq '.[]|select(.filename==F)|.patch' | grep -o '@@[^@]*@@'`.
Overlap (or within ~3 lines of context) ⇒ conflict plausible. Disjoint ⇒ `MERGEABLE` is expected and
a `MERGEABLE` reading is **evidence the probe works**, not evidence it is stale.

⭐ Corollary for the latch: `behind` growing (5 → 7 here) is a **normal resting value** and correctly
does not wake. That choice — `mergeable` (tri-state) over `mergeable_state` — survives this
falsification unchanged; it was the right field for the right reason, with the wrong story attached.

See [[project_12371_spirv_prelink_validation_buffer]],
[[feedback_mechanism_must_predict_observed_coordinates]],
[[feedback_a_diff_hunk_header_is_not_a_line_delta]].
