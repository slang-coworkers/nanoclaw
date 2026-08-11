---
name: feedback_running_an_experiment_is_not_reading_it
description: "I printed `7 failed | 15 passed` proving my own proposed fix broke the PR's suite, then recommended the fix anyway — because I scanned the output only for whether the FINDING reproduced. A result that refutes your REMEDY is invisible to a finding-shaped read."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 29108104-19da-446e-85bb-a01b2d15bc4d
---

# Running an experiment is not reading it

**2026-08-10, nanoclaw#1169.** I found a gap in a validator, drafted a one-line fix
(`counts.ok + counts.drift + counts.unknown === findings.length`), and — to test the gap — patched
the validator and ran the PR's suite. My own terminal printed:

```
=== does the extended net break the PR's own 22 tests? ===
     × accepts a clean report
     ... 7 lines ...
      Tests  7 failed | 15 passed (22)
```

I then restored the file, confirmed `22 passed`, and **drafted the finding recommending that exact
check**. An adversarial subagent later handed me back the same number as a refutation.

**Why:** I ran the experiment to answer *"does my finding reproduce?"* — and it did (the fixture was
rejected, the corrupt doc was caught). The suite-breakage line was in the same output block, one
scroll below, answering a question I had asked but was no longer looking for. **A finding-shaped
read filters for confirmation of the finding; the cost of the remedy is a different question and
falls outside the filter.**

The mechanism is not carelessness — the check was *deliberately included in the command*, which is
the tell that I knew it mattered. It is that **the question you asked when you typed the command is
not the question you ask when you read the output**, and only the second one gets answered.

**How to apply:**

- ⭐⭐⭐**Before proposing a remedy, state the command whose output would refute it — then go find
  that output. If you already ran it, re-read it; do not re-run it and do not reason about it.**
- **Two distinct verdicts per experiment, written down separately:** (1) does the defect reproduce?
  (2) does the proposed fix cost anything? A single "it worked" collapses them.
- **A patch-and-run against someone else's green suite has exactly one interesting failure mode:
  their tests going red.** If the run produced red lines you did not attribute, you have not read it.
- ⭐⭐**Any fix that requires editing the test helper or the fixture is not a one-liner.** Here the
  helper's own base document violated the invariant I proposed enforcing — which is itself evidence
  about the invariant's status in that codebase, and I walked past it twice.

Related: [[feedback_mechanism_must_predict_observed_coordinates]] (a verified leg still may not
support the conclusion), [[feedback_deference_drifts_to_whoever_corrected_you_last]] — the inverse
failure: there I discarded my own correct measurement for a peer's wrong one; **here I discarded my
own correct measurement in favour of my own preferred conclusion.** Both are "your own screen
already had it."
