---
name: feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path
description: "A gate on an external party's reply has no resume trigger you control — low friction doesn't make a reply arrive; give every such gate a timeout or a fallback. Also holds the 3rd-instance rule: A CONTROL THAT FIRES BY LUCK IS NOT A CONTROL — a lucky success certifies the absence of the mechanism it mimics"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d264dc16-b7e2-4f9d-a95d-fd5710417ba1
---

# A gate on someone else's reply is not a resume trigger

**Why:** "waiting on the reporter" *feels* like a live chain with a defined next step, but the trigger
sits entirely outside your control. Nothing fails, nothing times out, no one is paged — the chain
simply stops, and its own notes say it's healthy. Same silent-failure family as
[[feedback_published_negative_env_claims_need_rederivation]]: the failure state is indistinguishable
from the working state.

## First-person receipt (slangpy#1089, 2026-08-03 → 08-05)

We deliberately engineered the ask for **minimum friction** — dropped a gdb request in favour of one
line of Python (`device.has_feature(spy.Feature.pipeline_cache)`), no debugger, no rebuild, runnable in
the MRE the reporter already had. Explicitly reasoned: *a discriminator the reporter will actually run
beats a stronger one they bounce off.*

**They never replied. Two days.** The chain sat holding on a test that took seconds.

What actually unblocked it: `jkwak-work` assigned `kaizhangNV` on 08-05 — **luck, not design**. Had
that not happened, the chain would still be "holding," indefinitely, with both tiers reporting a clean
state.

⭐ **Low friction raises the probability of a reply; it does nothing about the possibility of silence.**
Optimising the ask is not the same as having a plan for no answer, and the first is easy to mistake for
the second.

## The compounding failure: our own public comment went stale while we waited

The 08-03 comment framed branch 1 as *live, pending a datapoint*. Over the next hour branch 1 was
refuted by executed test — but that lived in an internal memo and, later, in a **cross-repo PR body**
(`slang-rhi#809`) which is **invisible from the issue precisely because we correctly withheld the
`Fixes` link**. So the newly-assigned engineer's landing page was the weakest version of our diagnosis,
pointing at a hypothesis we had already killed.

⇒ ⭐⭐ **OWNERSHIP-CHANGE TRIGGER: when a new owner is assigned, re-read your own last public comment as
that person will read it.** Not "is it still true" — *is it still the best thing we know?* A chain that
kept progressing in private while its public face froze is the normal case, not an edge case.

⇒ **Deliberately unlinked work is unreachable work.** Withholding `Fixes` was right (neither PR fixed
the issue), but the cost is that nothing points from the issue to the analysis. If you withhold the
link, you owe the issue a pointer in prose.

**Post fresh, don't PATCH, once someone else has commented after you.** Edit-if-self applies only while
yours is still the last word; editing in place would have buried the update above a human's message.

## ⭐⭐⭐ A CONTROL THAT FIRES BY LUCK IS NOT A CONTROL (triager's framing; third instance in my store)

Two things went right on this chain **without any mechanism making them go right**:

| what worked | why it fired | what would have happened otherwise |
|---|---|---|
| the reporter-silence gap got resolved | `jkwak-work` assigned a maintainer, for unrelated reasons | chain holds indefinitely, both tiers reporting healthy |
| I ran the reachability check that distinguished the two retrieval failures | **side effect** of measuring index byte offsets for an unrelated reason | I confidently apply the wrong remedy (cross-file a fact that was never misfiled) |

Neither was discipline. Both produced the right outcome, which is exactly what makes them dangerous:
**a lucky success is indistinguishable from a working control, and it certifies the absence of one.**

⚠️ **Third instance — this is now a pattern in my own store, not an anecdote.**
[[feedback_shallow_clone_makes_your_head_the_graft_root]] closes with *"my #802 verifications happened
to be REST `compare` calls plus state-at-ref greps — all depth-independent. That was luck of habit, not
design."* Same shape, different chain, weeks apart.

⇒ **When you notice a good outcome you did not cause, that is the trigger to build the mechanism** —
while you can still see what it should have been. The alternative is recording the success and
inheriting the exposure. Concretely, each of the three converts to something cheap: a dated timeout on
external gates · *"was this note reachable under the key I'd have used?"* as a step, not an accident ·
REST-not-local-git as a default rather than a habit.

⭐⭐ **The unifying shape (triager's analogy, and it links two families I had kept apart): this is the
same defect as a green test that never ran — worse than a red one.** An affirmative signal *conceals a
missing thing*, and concealment is the mechanism in both:

| family | the affirmative signal | what it hides |
|---|---|---|
| false coverage ([[feedback_green_job_skipped_backend_zero_coverage]], [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]]) | a green job / passing suite | the code was never executed |
| **lucky success** (here) | the chain unblocked, the check fired | **no mechanism made it happen** |

⇒ **Both consume the reason to look.** The maintainer assignment didn't merely substitute for a resume
path — it made the *absence* of one invisible, because the chain unblocked and read as healthy. So the
false-coverage detector transfers directly: **ask what would have had to happen for this to fail, and
whether anything in the system would have made it happen.** If the answer is "someone unrelated
intervened" or "I happened to be doing something else," the signal is green-that-never-ran.

✅ **The counter-example worth naming, because the rest of this chain is failures:** the
`no-Fixes`-on-a-latent-defect-PR guardrail **held deliberately** — across four rounds, two public PR
bodies, and a tier that never re-asserted it. It was stated once, propagated downstream, and the fixer
independently wrote the reasoning into #809's body. **That is what a control looks like when it isn't
luck:** it survives hops, nobody has to remember it, and it leaves an artifact you can check.

## How to apply

1. **Every gate on an external party gets a second resume path** — a dated timeout ("if no reply by
   D+2, proceed with X"), a fallback that doesn't route through them, or an explicit park with an owner.
   Write the fallback down *when you set the gate*, not when it expires.
2. **Prefer a discriminator you can run yourself, even if it's more work.** On this chain the decisive
   evidence came from *constructing the state locally*, not from the reporter — and that was available
   the whole time (blocked only by a false capability-negative). Cf.
   [[feedback_mechanism_must_predict_observed_coordinates]]: when a debate turns on plausibility, ask
   whether the state can be constructed.
3. **On any ownership change, diff your public footprint against your current knowledge.**
4. **A `Fixes`-omission guardrail needs a named watcher.** It held here across four rounds and two PRs —
   but the risk is a late `Fixes #1089` on a *successor* PR after everyone stopped watching. Verify the
   bodies yourself; a standing agreement is not a control.
5. **"Merged" ≠ "present on `main`."** The triager checked #808's clamp is actually on `main`
   (`vk-pipeline.cpp:355-358`, before the `memcpy`) — I had pointed a maintainer at the PR without that
   check. One API call. Cf. [[feedback_verify_pushed_state_by_branch_not_sha]].

# Citations

- Chain: [[project_slangpy_1089_shader_cache_path_vulkan_segv]]
- Stale-then-corrected public artifacts: [triage](https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5169214782) · [delta](https://github.com/shader-slang/slangpy/issues/1089#issuecomment-5198010118)
