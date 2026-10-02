---
name: feedback_a_prediction_in_the_past_tense_reads_as_an_observation
description: "In a note, a prediction and an observation share grammar — 'returns exit 0' written about a command never run inherits a measurement's authority. Mark predictions as UNRUN; default to 'I have not exercised this', never 'this is broken' (an over-claimed instrument defect poisons a working check). Case: slang-fixer on extras/formatting.sh with clang-format absent (+ the script's three exit cases and the bare-18 version-gate edge)."
metadata: 
  node_type: memory
  type: feedback
  tags: 
    - instruments
    - claims
    - formatting
  originSessionId: d264dc16-b7e2-4f9d-a95d-fd5710417ba1
---

# A prediction written in the past tense is indistinguishable from an observation

**2026-08-07, slang-fixer, `extras/formatting.sh`.** It reported: *"`clang-format` was absent. Running
`formatting.sh --cpp` in that state returns exit 0 with the C++ arm structurally unable to fail."* It
**never ran it** in that state — it observed `command -v clang-format` → absent, **predicted** the
script's behaviour, and wrote the prediction in the past tense.

Verified against master: `:203` `require_bin "clang-format" "17" "18"`; `:167-170` set `missing_bin=1`
when `command -v` fails; `:207-209` `if [ "$missing_bin" ]; then exit 1; fi` runs **before** any
formatting (`exit_code=0` isn't set until `:223`). Running the real `require_bin` against an absent
binary → **rc=1**; the fixer's edge reproduced rc=1.

⭐⭐⭐ **Mechanism:** *"returns exit 0"* and *"I observed exit 0"* look identical a day later, so the
prediction inherits a measurement's authority — from the one party who knew which it was. ⇒ **Mark
predictions as predictions in the artifact** (*"expect rc=0 — UNRUN"*); the tense is the only surviving
evidence of modality. Sibling: [[feedback_published_negative_env_claims_need_rederivation]] — both are
claims with no failure signature. Cf. the past-tense-verb tell in
[[feedback_control_the_instrument_not_the_reasoning]] and
[[feedback_a_recommendation_stated_as_done_is_a_false_public_fact]].

⚠️ The fixer's own note already said *"the GATE IS LOUD — the silent false-green is the BARE form."* Not
a missing rule; a rule overridden by a fresh-feeling inference.

⭐⭐⭐ **Cost asymmetry (the fixer's rule, adopted verbatim): over-claiming an instrument defect POISONS
EVERY FUTURE USE OF A WORKING CHECK, so the default is "I have not exercised this," never "this is
broken."** Here it also devalued a valid earlier clean run (re-read unpiped: `TRUE_EXIT=0`,
`found clang-format 17.0.6, required [17, 18)`). Installing clang-format was still necessary — absent ⇒
rc=1 ⇒ nothing formatted — but the stated reason was false.

## `extras/formatting.sh` exit cases

| invocation | outcome |
|---|---|
| bare, no args (`:47-50`) | rc=0, **silent false-green — the only silent one** |
| explicit action, tool absent | rc=1 + `isn't in $PATH` |
| explicit action, wrong version | rc=1 + `is too new` |

⚠️ **Version-gate edge** (reproduced on both edges): the max check is
`! printf '%s\n%s\n' "$version" "$max_version" | sort -V -C`, so `17.0.6` ✓, `18.0.0` ✗, but **bare `18`
✓** (`18\n18` is non-decreasing) ⇒ the interval is `[17,18)` for `18.x` and `[17,18]` for a bare integer.
