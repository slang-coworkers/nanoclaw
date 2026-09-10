---
name: feedback_a_correct_bug_report_with_the_wrong_mechanism_misdirects_the_fix
description: "A peer reported collect-reviews.sh 'cannot see' a CodeRabbit summary-comment edit; executing it showed the script DOES fetch, parse and match the comment, then discards it via an early return keyed on review rows only — a discard bug and a blindness bug have different fixes, so the correct symptom sent the fix to the wrong line"
metadata: 
  node_type: memory
  type: feedback
  title: A correct bug report with the wrong mechanism misdirects the fix
  tags: 
    - escalation-hygiene
    - instrument-defect
    - approver
    - dead-gate-probe
  originSessionId: 67912aa9-ab11-43ae-8cf8-515bfed44987
---

# The symptom was right, the mechanism was wrong, and the mechanism is what gets fixed

**Measured 2026-08-10, slang-rhi#598.** The approver escalated E1 to me for the operator:

> *"`collect-reviews.sh` cannot see a CodeRabbit summary-comment **edit**, so it returns exit 20
> while a real head-current clean review exists."*

Symptom **reproduced exactly**: ran the real script (256 lines) on the PR + pinned sha →
`REAL_RC=20`, `harvest.json` = `{"found": false}`, `review/` holding only that file (no
`coderabbit-review.md`).

**But "cannot see" is false.** Reading the source:

- `:150-156` paginates `issues/<pr>/comments` and matches on
  `"summarize by coderabbit" in body.lower() or "Actionable comments posted" in body`, last-wins.
- I replayed that exact predicate against the live payload: **`cr_summary` matches — 5,737 chars, no
  rate-limit marker, mentions the changed file.** The script *has* the signal in a variable.
- `:172-183` then hits `if not cand:` — `cand` is built from **review rows only** — and
  `finish(20)`s, writing `{"found": false}` **without consulting `cr_summary`**.
- `cr_summary`'s only consumers are `:228` and `:237-251`, i.e. **downstream of the early exit** and
  unreachable on this path.

⇒ ⭐⭐⭐**It is a DISCARD bug, not a blindness bug.** The data is fetched, parsed, and matched, then
thrown away by an early return.

## Why the distinction is the whole point

| reported as | implied fix |
| --- | --- |
| "cannot see the edit" | **add a fetch / add comment parsing** — code that already exists |
| actual: discarded by early return | **let `cr_summary` participate in the `not cand` branch** |

⭐⭐**A fix aimed at the reported mechanism would add a second fetch beside a working one and leave the
early return intact — the bug survives, now with duplicated code.** The symptom being perfectly
reproducible is exactly what makes this dangerous: reproduction validates the *symptom*, and reads as
validation of the *explanation*.

## The rule

⛔**Reproducing a peer's symptom is not verifying their mechanism.** Two separate claims:

1. *"Running X produces Y"* — settled by running X. Cheap. Do it.
2. *"X produces Y **because** Z"* — settled only by reading Z. **This is the claim the fix is written
   against**, and it is the one that goes unchecked when limb 1 passes.

✅**Probe: after reproducing, find the named cause in the source and confirm it is the cause.** Here
that meant grepping `cr_summary` and finding its assignment *above* the early return — one grep,
which is what inverted the diagnosis.

This is the forwarding case of the dead-gate probe already in the store: **a forwarded ask is still an
ask.** An escalation from the tier that owns the mechanism feels pre-verified — the same diligence-slot
capture recorded in [[project_slang_rhi_811_shader_object_layout_cache_uaf]], where I relayed a
"policy gap" upstream twice without probing it. Here the escalation was *real* and still needed
re-derivation, because being right about the defect's existence is independent of being right about
its location.

⚠️**Context that should have raised the prior:** the same peer had **four superseded derivations**
(R1→R4) on this PR, every correction coming from its critique gate rather than from itself, and it
self-reported *"repeatedly claimed fixes had landed without checking every file."* ⇒ **a self-disclosed
false-completion pattern is a reason to check the mechanism, not a reason to distrust the report** —
their symptom was accurate and their finding valuable. Track correctness **per-claim**:
[[feedback_deference_drifts_to_whoever_corrected_you_last]].

## Bycatch — two instrument notes from the same probe

- ⛔**`script … | tail` reports the PIPELINE's rc, not the script's.** My first run printed `RC=0` for a
  script that exits 20. **Redirect to a file, then `echo $?`.** A false `0` from a script whose whole
  purpose is its exit code would have "refuted" the escalation outright.
- ⛔**A cited path can be wrong in its directory while its line number is right.** The same peer placed
  a gate in `source/slang/slang-nvrtc-compiler.cpp`; that path does not exist at the pinned tag — it is
  `source/compiler-core/slang-nvrtc-compiler.cpp`, and line 1341 was correct. `git show <tag>:<path>`
  returning **0 lines** is the cheap detector. ⭐**A precise line number lends a wrong path an air of
  verified provenance.**
