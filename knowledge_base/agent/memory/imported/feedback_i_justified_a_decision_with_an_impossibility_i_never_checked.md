---
name: feedback_i_justified_a_decision_with_an_impossibility_i_never_checked
description: "I ruled 'no test' on slang#12379 by asserting no discriminating test was POSSIBLE. A release.yml step in the same job as the LTO flag made one possible. Right call, wrong reason — and the wrong reason is what propagates."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8246ae29-ea58-4221-b5b7-ef70556a0a7b
---

slang#9146 / PR #12379 (2026-08-06). The fixer escalated "should we add a binary-export test
facility?" I ruled **no**, and gave two reasons:

1. **Scope:** it's build-infra with its own reviewers; don't bury a 2-file fix under new test machinery.
2. **Impossibility:** *"any test you could write here would assert the passing state in an environment
   that already passes — it would pin the flag's presence, not the property."*

**Reason 2 was false.** `release.yml:352` has an existing `File check` step, and it sits in the **same
`release` job** that sets `-DSLANG_ENABLE_RELEASE_LTO=ON` at `:156` (I verified by parsing job keys —
the file has exactly three top-level blocks, `workflow_dispatch:4`, `push:5`, `release:11`, so both
lines belong to `release`). An assertion there runs in the shipping configuration against the packaged
artifact. The reviewer built one and validated **both poles**: passes with all nine names, and names
`glslang_linkSPIRV` when that name is dropped from the map. A genuine red→green.

The fixer re-opened the ruling rather than executing it, with the right framing: *"not asking you to
reverse it — asking you to re-decide with a fact neither of us had."*

## The lesson

⭐⭐⭐ **When a decision has a sufficient reason and a stronger-sounding reason, the stronger-sounding
one is what gets quoted downstream — so an unchecked one does damage even when the decision is
right.** My scope argument was sufficient and true. I added an impossibility claim I had not tested,
and it went into the PR's framing, where it would have told every future reader that no discriminating
test exists. The decision survived; the justification had to be publicly replaced.

⇒ **Before writing "X is not possible here," enumerate the places X could live and say which you
checked.** For a CI test: list the workflows, find the ones that build the target configuration, check
whether any already has a step you could extend. That is minutes of work and it is the whole claim.

⭐⭐ **A capability-negative is the error class with no failure signature.** Readers comply by *not
attempting*, which logs nothing — so the claim is never falsified in the normal course of work. Second
instance for me; see [[feedback_published_negative_env_claims_need_rederivation]]. The safe form is
*"I did not find a hook that runs in the leaking configuration; I looked at M"* — with M named.

⭐⭐ **Corollary — keep the reasons separable.** Because reason 1 stood on its own, the fix was cheap:
delete reason 2, keep the ruling, and the follow-up (a separate PR for the reviewer's assertion) is
now a *scope judgement* instead of a *nothing-is-possible* claim. Had I fused them into one argument,
the false half would have taken the true half down with it.

⭐ **Also worth keeping: the subordinate re-opened a closed decision on a factual premise, and was
right to.** "Closed out" is not a shield against a new fact. The failure mode to avoid is a peer
executing a ruling they know rests on something false because reversing it looks like friction.

## ⭐⭐⭐ AN INSTRUCTION CAN CARRY AN UNSTATED CAPABILITY-NEGATIVE — same chain, second instance

Later on the same PR I told the fixer to **"file the `m_link` unguarded-deref as its own issue."**
`#12355` already tracked it exactly (OPEN, `reproduced`, assignee jkwak-work, same file and mechanism).
They declined and cited it instead — correctly.

The fixer's generalization is sharper than my first framing ("the dedup check belongs to whoever issues
the instruction"), so keep theirs: **a "file an issue" instruction silently ASSERTS that no tracker
exists, and that assertion has no failure signature at the point of issuance.** If the executor
complies, a duplicate appears and *nothing logs that the search was skipped* — the negative was never
stated, so it was never checked, so it cannot be refuted. Structurally identical to the published
capability-negative above, only embedded in an imperative instead of a claim.

⇒ **Every directive of the form "create X" embeds "no X exists." Discharge it before issuing:** one
`gh search issues` / `gh pr list` costs seconds. Applies to filing issues, opening PRs, creating
files, adding helpers, writing tests, spawning coworkers.

⇒ **Executor-side counterpart: a directive whose embedded premise you can cheaply check is worth
checking before complying.** Declining-and-flagging beats compliance here; the fixer's
"one instruction I didn't follow, deliberately — say the word if you still want it" is the right shape
(surfaces the conflict, leaves the decision upstream, doesn't silently drop the task).

⚠️ **Related precision the fixer added, worth not overstating on my side:** I praised the PR's in-tree
comment (at the export site, pointing at `slang-glslang.map`) as making the earlier wildcard error
"refuted in-tree, permanently." True, but **a comment is documentation, not enforcement** — someone
adding an export can still skip the map and the build stays green, because the omission is silent at
link time. The note narrows the odds; only the packaged-artifact assertion (deferred to a follow-up PR)
would actually catch it. ⇒ **Don't let "the lesson is now in the code" read as "the failure mode is now
prevented."**
