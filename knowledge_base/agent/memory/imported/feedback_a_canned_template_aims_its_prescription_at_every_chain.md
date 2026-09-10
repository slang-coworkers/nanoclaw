---
name: feedback_a_canned_template_aims_its_prescription_at_every_chain
description: "A nudge template that ends \"once green, mark ready for review\" prescribes an action it cannot evaluate; measured on a diff with 4 known defects where green would have meant \"untested\", not \"fixed\". Fix the template, not the nudge."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c0e1ba15-ffd2-415b-8863-05252d81ad0e
---

Measured 2026-08-11 (supervisor tick 130). My CI-rebase nudge template ends:

> *"Once it goes green, mark ready for review."*

I aimed it at PR #12155. The fixer declined, and its **second** reason is the one
that matters (the first was that `gh pr ready` is operator-gated):

> *"This PR should not go green-then-ready, because the diff is known-defective.
> ... A green CI run would not make any of that untrue — it would just mean no
> test covers it. Flipping ready would put a known wrong-output patch in front of
> maintainers **with a green badge on it**."*

Four measured defects stood at that diff (guard emits silently-invalid MSL; a new
line derefs null on a non-struct-return + `out` shape; a latent silent
wrong-`@location` miscompile; rebuilt layout assigned to a local and never written
back). I withdrew the flip.

⭐⭐⭐ **The defect is in the TEMPLATE, not in that nudge.** A canned sentence
carries its prescription to **every chain it touches** and has no awareness of
whether the precondition is meaningful there. "Once green, mark ready" silently
assumes *green ⇒ correct*. Green means **no test covered the defect**.

⇒ **A supervisor may report a state; it must not prescribe the action that state
implies** when the owner holds evidence the supervisor doesn't. Say *"CI is green
and the PR is BEHIND"*; stop there. The tier holding the diff decides what
follows. Removing the clause fixes N future nudges; arguing it per-nudge fixes one.

**The general shape — a boilerplate prescription is an unfalsifiable instruction.**
It is never wrong *about a fact*, so nothing ever flags it; it is wrong about
*what to do*, which only the owner can see. That is why it survived many ticks:
no measurement of mine could have caught it, and only a peer's refusal did.

⚠️ **Corollary measured the same tick — my other CI inferences were also
template-grade wrong:**
- *"the failing job is not the yield gate ⇒ a real failure"* — no. `filter`
  **cancelled with `steps:[]` and no runner** is *never-scheduled infra*, and
  `check-ci` failing downstream of 25+ `needs:` is a faithful consequence. My
  legend has **no cell for never-scheduled**; it collapses into ❌ and reads as
  "something in the diff to fix."
- *"same run id as last tick ⇒ nobody re-dispatched"* — invalid once the **head
  has moved**. The id was unchanged because a newer run existed at the new head
  as the expected draft `pull_request` skip.
- *"⏸️ yielded self-heals, show but never act"* — the retry helper is
  **contention-gated, not a timer**: eligible at 12h (`ci.yml --max-yield-hours
  12`), **terminal past 16h** (`ci-retry-yielded-bot --lookback-hours 16`), one
  rerun slot, oldest-first. So a yield can expire unrerun. And the helper's own
  run concludes **`success` even when it decided to do nothing** — the instrument
  is `run_attempt` on the *target* run, never the helper's conclusion.
  ⇒ my proposed "still `attempt=1` at 12h ⇒ terminal" test would have
  **false-positived at the exact moment the mechanism became eligible**.

⇒ ⭐⭐**"CI never went green" and "CI never ran" look identical in a status
rollup.** Four dispatches on #12155 produced zero build-CI signal across three
distinct infra states. A rollup that cannot separate those two reports absence of
success as presence of failure.

Related: [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]],
[[feedback_mechanism_must_predict_observed_coordinates]]
