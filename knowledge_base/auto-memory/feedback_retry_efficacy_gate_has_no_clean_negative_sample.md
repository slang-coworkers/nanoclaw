---
name: feedback_retry_efficacy_gate_has_no_clean_negative_sample
description: "⛔SELF-REFUTED WITHIN MINUTES — I claimed a 'do retries go green?' sample didn't exist, reasoning from a repo-wide 5-reruns count; the babysitter measured 4/5 recoveries and I verified all 4. Lesson INVERTED: never publish 'cannot be measured' without running the query that would find the sample."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 8ae42c2d-1623-4a18-b809-9b7ef4286691
---

# ⛔ THIS FILE'S ORIGINAL THESIS WAS WRONG. I asserted a sample didn't exist; it did.

**Read this correction first — the reasoning below is preserved because the ERROR is the lesson.**

I concluded from my store's *"only 5 reruns fired in the same window"* plus one `run_attempt=1`
observation that a retry-efficacy sample for #12145 likely **did not exist**, and drafted advice to the
babysitter to abandon its measurement gate as unresolvable. **Minutes later it delivered the
measurement: 4/5 failed→next-attempt recoveries.** I verified all four independently via REST:

| run | attempt | conclusion | attempt-1 failed jobs |
|---|---|---|---|
| `30817212043` | 2 | success | `test-falcor / Test (Falcor)`, `check-ci` |
| `30974153371` | 2 | success | `test-falcor / Test (Falcor)`, `check-ci` |
| `30973012280` | 2 | success | `test-falcor / Test (Falcor)`, `check-ci` |
| `31032875535` | 3 | success | `test-falcor / Test (Falcor)`, `check-ci` |

Confirmed on two of them that it is **this** signature, not another Falcor red — log greps:
`GBufferRTTexGrads`×3, `3221225477`×1, with `renderpasses/test_GBufferRTTexGrads_d3d12 : FAILED`
while `ActivationFunction_HSigmoid` shows `[ OK ]` on **both** D3D12 and Vulkan (the stored
discriminator). ⇒ **Reruns of this exact flake go green. The gate was answerable, and the answer
supports the maintainer's remedy.**

## ⭐⭐⭐ Why I got it wrong: I reasoned from a count whose SCOPE didn't match my claim

*"Only 5 reruns fired in the same window"* is **repo-wide, 7-day, from the babysitter's own action
log** — a record of *reruns it issued*. I used it to conclude something about **whether any
`test-falcor` job had ever been rerun by anyone**. Different populations: the recoveries were
`event=pull_request` reruns on PR branches, invisible to the merge-queue eviction analysis my store was
built from. **My one direct observation (`run_attempt=1` on `30957913120`) was a single merge_group run,
generalized to a population.**

⛔**The failure was not "missing data" — the data was one API call away and I never made it.**
`.../runs/<id>/attempts/1/jobs` settles it; I had run IDs in hand. I wrote a leaf file arguing a
measurement was impossible instead of spending one query attempting it.

⭐⭐⭐**RULE: before publishing "X cannot be measured / no sample exists", name the query that would
find the sample and RUN it.** Negative-existence claims are the class with no failure signature — the
reader complies by *not looking*, which logs nothing ([[feedback_published_negative_env_claims_need_rederivation]]).
Here it would have talked a peer out of a correct, already-completed measurement.

⭐⭐**Corollary — an absence in an index proves absence FROM THAT INDEX, nothing more.** My store
indexes merge-queue evictions; PR-branch job reruns aren't in it. **Ask what an index covers before
reading a zero as a fact about the world.** Same family as
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

⚠️**The babysitter's gate was right and I was wrong to question its resolvability.** It refused to ship
a coin-flip, measured, got a real answer, self-flagged the sample as biased (runs it had already chosen
to rerun), and traced the single non-recovery to #12341's SLANGWIN5 — a different defect. **That is a
properly hedged measurement.**

---

## Preserved original reasoning (thesis falsified above; the *shape* of the concern stays valid)

The general worry — a gate can rest on an unobtainable sample — is real and worth keeping. It just
wasn't this case.

# A measurement gate needs its sample to exist before you hold delivery on it

**2026-08-06, slang#12145.** `slang-ci-babysitter` held delivery of a retry-logic diff on one
measurement — *"whether a rerun of this job actually goes green"* — reasoning that if retries mostly
fail again, "add retry logic" is the wrong remedy and quarantine is the honest fix. **The reasoning is
excellent: it is a falsification test on the maintainer's own proposal, run before shipping it.**

**But the sample may not exist.** What the store had already measured for this signature:

- **12 re-adds, 12 by a NAMED HUMAN, 0 by `github-merge-queue`.**
- **Only 5 reruns fired in the same window** — across the *whole repo*, not this signature.
- The known eviction (merge_group run `30957913120`, PR #12322) shows **`run_attempt=1`** — never retried.

⇒ ⛔**A human re-adding a PR to the merge queue produces a FRESH RUN on a new merge-group SHA, not a
rerun of the failed job.** Those two look similar in a queue timeline and are different measurements.
A "did the retry go green?" question asked of that population is answered by *fresh-run* outcomes, so
it silently measures the flake's base rate instead of retry efficacy.

⭐⭐**The trap: "0 reruns observed" reads as evidence retries don't help, when it is evidence nobody
tried.** An empty sample and a negative sample are indistinguishable in a summary count, and the
empty one licenses exactly the wrong conclusion — abandoning the maintainer's remedy for a heavier
one (quarantine) on the strength of no data.

⭐⭐⭐**So before holding a deliverable on a measurement, ask what N is and whether the events are the
kind you need.** If N is 0, the gate cannot resolve and the hold becomes indefinite — the deliverable
is blocked by a question that history cannot answer. Say so and pick a different discriminator.

**The discriminator that IS available here** (fresh-run outcomes on re-added PRs, which the store
already had): of the re-added PRs, **#12152, #12289, #12328, #12122, #12151 all subsequently MERGED**
(Main-verified via REST 08-06); only #12322 is still open. A PR-code-independent crash that clears on
a later run of the same code is the definition of an intermittent — **so the flake does clear on
re-execution, which is the substance of what the gate wanted to know.** It bounds retry efficacy from
history rather than waiting for a rerun that may never be issued.

⚠️**This does not make the hold wrong** — a real per-job retry rate would be strictly better evidence,
and the babysitter's instinct to refuse to "ship a coin-flip" is the right one. It makes the hold
*unbounded*, which is the failure mode: see [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]
for the general shape — a gate whose trigger you do not control needs a fallback set at the same time
as the gate.
