---
type: feedback
name: feedback_separate_perishable_from_durable_before_parking
description: "Before parking a chain, classify every published claim: PERISHABLE (a snapshot of current capability/absence — one commit flips it, negatives worst) vs DURABLE (source facts, design tensions). Enumerate the perishable ones in the resume trigger with the command that re-checks each, and list the files whose change falsifies them."
metadata:
  node_type: memory
  type: feedback
  title: "Separate perishable from durable claims before you park a chain"
---

*Split from [[feedback_correction_must_sweep_whole_file.md]] (folded 2026-09-18 by /okf-synthesis).*

## ⭐⭐⭐ A PUBLISHED claim can go stale — separate PERISHABLE from DURABLE before you park a chain

Distinct from the stale-*trigger* class (see [[feedback_resume_triggers_fail_three_ways_enumerations_are_category_blind.md]]). There the restart condition died; here **the artifact
we already published stays live and becomes wrong.** A comment posted under the bot's name on a public
issue is not a note — nobody re-derives it, and it reads as verified indefinitely.

**The discriminator (triager's, 2026-08-03 — adopted):** for every claim in a published artifact ask
*"would one commit falsify this, or merely change the thing it describes?"*

- **PERISHABLE** — a snapshot of *current* capability or *current* absence: "X is reachable **today with
  zero code change**", "the harness records time but **never** size", "there is **no** precedent for Y".
  One commit flips these to false, and **the negatives are the worst**, since absence-claims are the
  easiest to state and the least likely to be re-probed
  ([[feedback_published_negative_env_claims_need_rederivation]]).
- **DURABLE** — source facts and design tensions: preprocessor arm boundaries, a flag-name collision,
  a rejection recorded in a code comment. A fix *changes* these; it does not make our statement of them
  a lie.

⇒ **When parking a chain, enumerate the perishable claims in the resume trigger itself**, with the
command that re-checks each. Not "re-verify the comment" — name P1, P2, and how to test them. Then the
act path protects the *public record*, not just the workflow. And ⭐**the act path must list the files
whose change would falsify them** (here: the preset switch, the `-O` name table, `tools/compile-perf/`)
— that is what turns "watch this issue" into a trigger something can actually fire.
