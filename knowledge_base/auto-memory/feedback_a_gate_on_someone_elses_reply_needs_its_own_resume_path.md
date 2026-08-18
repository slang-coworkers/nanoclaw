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

## ✅⭐⭐ 2026-08-08 — 4th and 5th instances, both BUILT in the turn the gate was set; and the ALWAYS-TRUE branch is a heartbeat, not a signal

Two gates on external humans in one session, both wired immediately instead of promised:

| gate | promise I almost left | built |
|---|---|---|
| CI run #30098 needs a `ci-approvers` approve/cancel | *"I'll tell you when it clears"* | `ci30098-blocker-clear-5975`, `*/20`, keys on run id `31179559787` |
| #12386 needs operator authorization to post | *"requesting authorization"* then waiting | `i12386-footprint-gate-d856`, `0 */6`, keys on comment bodies + PR draft flag |

⛔ **THE NEW DEFECT, caught only because I ran the script before scheduling it: my first version returned `wakeAgent: true` on EVERY fire.** The steady state — *"still unanswered"* — is the **expected** condition while a human decides, so waking on it is a heartbeat that trains me to ignore the task. Fixed with a persisted counter (`/workspace/agent/.i12386_footprint_fires`) firing at fire 4 (~24h) and fire 12 (~72h), then never. ⇒ ⭐⭐⭐ **A watcher whose default branch is "wake" has no signal — enumerate which branch is the STEADY STATE and make that one silent.** Cf. [[feedback_a_spent_one_shot_stays_pending_and_invites_a_rerun]]: same family, opposite end — there a repair fired on a state it could not distinguish; here a watcher fires on the state that means *nothing has happened*.

⛔ **BOTH OF MY FIRST TWO CONTROLS WERE BUILT ON FALSE PREMISES AND VALIDATED NOTHING.** I pointed one at issue #12384 "as a closed issue" (it is **open** — never checked) and one at #12371 while still grepping for `12434` (a string that was never going to be there). Both printed the *same* `STILL_UNANSWERED` as the live run, so **the output was indistinguishable from a working control** and I would have called the gate armed. ⇒ ⭐⭐⭐ **A control asserts a PREMISE about its target; verify that premise before reading the control's output.** Fixed by querying for a genuinely closed issue (`?state=closed` → #12432 → `ISSUE_CLOSED` ✓) and by grepping a string I had *confirmed present* (`"Triage summary"` → `FOOTPRINT_CLOSED_ELSEWHERE` ✓). ⚠️ **This is the same shape I had just spent the session correcting in two peers** — an unarmed check and a spliced coordinate — which is the point: knowing the failure class does not exempt the next instrument you build.

✅ **Both gates now proven at every branch, including the negative:** an unreachable API returns `wakeAgent: false` with a note, **never** a false "cleared"/"closed". ⇒ **A watcher that cannot distinguish "resolved" from "can't tell" is worse than no watcher**, because its silence reads as coverage.

## ⛔⛔ 2026-08-17, slang#12462 — THE GATE FIRED CORRECTLY (as a webhook), AND I LET RETIRING IT SWALLOW THE WORK IT WAS STANDING IN FOR. 3-day drop, caught by the maintainer chasing.

Chain: I filed #12462 (render-test HLSL-prelude blanking, a *decision request*) via the triager, correctly identified it as needing a **resume path not a triage**, and built `i12462-maintainer-gate-5e32` (`0 */6`, fires on close or any non-bot comment; proven on 5 controls). Textbook application of this leaf. Then:

- **08-14 17:51Z** — `tangent-vector` (assignee) answered by **`pr_mention` webhook**, authorizing Approach A: *"Go ahead and make a PR to remove the forced blanking."* The reply came through the **primary channel** (webhook), arriving before the gate's next 6-hourly fire. Good — the gate was a *fallback*, and the primary path worked.
- **My prior turn then**: recognized the reply was a fix-authorization, started to cancel the now-moot gate… hit a `ncl tasks cancel` that errored (`no live task matched`) and a task-list that resolved to different scopes across calls, spent the turn chasing the cancel, and **ended silent without dispatching the fixer.** The webhook that was supposed to *trigger* work instead triggered cleanup, and cleanup consumed the turn.
- **08-17 23:33Z** — maintainer chases: *"Is anything happening? I asked you to make a PR but don't see progress in 3 days."* No PR existed (`search … type:pr` → `total_count: 0`).

⭐⭐⭐ **THE NEW FAILURE MODE: a fallback gate's success condition and the chain's real next-action are the SAME EVENT (the human replied), and when that event arrives by the primary channel, "retire the gate" and "do the work" are triggered together — so mishandling the retirement can eat the work.** This leaf taught *build the fallback*; it did not teach that **firing the fallback (or its primary-channel equivalent) is a dispatch trigger, not a bookkeeping trigger.** The gate being moot is the LEAST important consequence of the reply.

⇒ ⭐⭐⭐ **When a gated-on reply arrives: DISPATCH THE WORK FIRST, retire the gate SECOND.** The order is load-bearing because retirement can fail (stale task id, scope-flapping `ncl tasks`) and a failed retirement must never block the dispatch. A moot gate that fires once more is a harmless no-op wake; a dropped fix authorization from a lead is a 3-day miss chased in public.

⚠️ **And a stalled cancel is not a reason to hold.** `ncl tasks cancel <id>` / `ncl tasks list` returned different scopes on consecutive calls this session (bare list vs `--group` gave disjoint sets; the created id `…-5e32` was "not found" moments after creation). That is a tooling flake to route around, not a gate on the real work — cf. the session self-corrected the moment I stopped chasing the cancel and just sent the dispatch (the moot gate's session was already `closed`, so no duplicate anyway).

✅ **Recovery mechanics that worked:** the triager owns this chain (filed + triaged + holds the (A)/(B) provenance + GitHub-write), so I reached the fixer THROUGH it, not by a direct Main→fixer send (cf. ANCHOR H). Its 08-14 session was `active`/`stopped` on the canonical thread; **pinned the wake with `target_session_id`** so it resumed with the disposition context rather than cold — verified `stopped → running` on the pinned id, not a fresh mint. ⇒ **A gated chain that later needs a dispatch: resume the OWNING session by id, don't start a new one that has to re-derive the decision.**
