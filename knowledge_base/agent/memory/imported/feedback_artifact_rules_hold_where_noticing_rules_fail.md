---
name: feedback_artifact_rules_hold_where_noticing_rules_fail
description: "Across ~17 instances in one week, every 'notice the risky state, then be careful' rule failed at least once (often in the turn that filed it); every 'emit an artifact before speaking' rule held. Prefer print-the-rows / bisect / enumerate-before-conceding over awareness rules, for prose and for gate design."
metadata:
  node_type: memory
  type: feedback
---

# Artifact rules hold where noticing rules fail

Split out of [[feedback_four_states_where_the_decisive_check_feels_unnecessary]]. Sorting that
catalogue's remedies by what they ask of you gives one discrimination that survived all ~17 instances:

| class | asks | record |
|---|---|---|
| **Noticing rules** — the states catalogue, "audit while correcting", "report the resolution your evidence has" | recognise a risky mental state, then be careful | every one failed at least once, including in the turn that filed it |
| **Artifact rules** — print the per-item result, bisect from the minimum accepted shape, enumerate before conceding unanswerability, simulate the truncation and diff | produce an output before speaking | none failed |

**A rule that requires me to notice something has already lost, because the failure states are
defined by not noticing.** The moment of writing is when attention is on the sentence, not the evidence.

## The decisive experiment (08-08, by accident)
Two tiers committed the same error on the same material one round apart, right after codifying the
rule against it: the peer wrote *"wgpu's **only** `.size` line"* (three exist: `:46`, `:75`,
`:146`); I wrote that a diverged compare had **24** files (it had **22**). Both of us **printed the
list, then typed a number we had not counted from it**, with *"a hit is not a predicate; read the
operator AND count the hits"* already filed that week. The repair supplies confidence that spills onto
whatever is adjacent — including the next clause.

## Operative artifact rules
- **Print three rows before typing "only"; `cat -n` and read the count off the last line.**
- **One comparison is not an isolation — it is a guess with a control.** Strip to the minimum
  ACCEPTED shape, confirm, then add back one variable at a time.
- **Report the resolution your evidence actually has.** *"Payload size matters, ~60 chars safe, exact
  limit unknown"* was fully supported and would have needed zero corrections; every retraction came
  from stating a sharper cause than the data carried.
- **Stop probing when the probe costs someone else** — each bisect fired a real decision card at a
  human; once the workaround was known, a tighter threshold was not worth more cards.
- **State the RANGE with any count.** Four ranges answered to "the file count" on one PR
  (single-commit 2 · PR-level 6 · diverged 22 · submodule 6/270).
- **Name the vulnerable step, not the whole tool.** `eval-clauses.py` was already correct (it diffs
  `base_ref...sha`); the exposure was a human hand-feeding it a diverged list. The distinction decides
  whether someone patches code or fixes a procedure.
- **Exchange the artifact, not the argument.** Three rounds of mutual re-verification could not settle
  a two-artifact disagreement (each side read its own disk correctly); two file reads did —
  [[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]].

⇒ When choosing between "be careful about X" and "emit an artifact that makes X visible", only the
second has a clean record. This applies to designing gates and policies, not just to my own prose.
