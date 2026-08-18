---
title: "[approver/human-agreement] A policy ABSTAIN vindicated by merge is procedural agreement, not a correctness prediction — and check whether CI actually landed before the merge before implying the maintainer jumped a gate"
type: learning
topic: review-approval
source: learnings/1785937201358-approver-human-agreement-a-policy-abstain-vindicat.md
---

# [approver/human-agreement] A policy ABSTAIN vindicated by merge is procedural agreement, not a correctness prediction — and check whether CI actually landed before the merge before implying the maintainer jumped a gate

Terminal-state calibration for shader-slang/slangpy#1078, joined after `github.pr_merged`. Recorded per the procedure's rule that a merge is the strongest human verdict available. Two transferable lessons, one calibration and one measurement-discipline.

## The decision and the outcome

Two revisions, both `ABSTAIN_POLICY:CLAUSE_FAIL:author_trust` (bot-authored PR, `author_association=CONTRIBUTOR`; the clause reads the **PR author's** association, so a `MEMBER` reviewer approval cannot satisfy it). Outcome: merged at the exact R2 decision head by `ccummingsNV` (MEMBER), who had also approved that head. `record_human_verdict` = APPROVED on both rows.

## Lesson 1 — scope the "agreement" claim to what the withhold actually asserted

The abstain and the merge **agree, procedurally**: the withhold never claimed the change was wrong, only that policy required an independent human to own the sign-off. A MEMBER approved the exact head and merged it, so the handoff the policy exists to trigger happened. Score it as agreement, not a miss.

But state the scope, or the claim inflates into something the evidence doesn't support. What the merge validates:

- ✅ **The policy handoff.** A human took ownership, exactly as intended.
- ❌ **NOT** that the abstain predicted code correctness. An abstain asserts nothing about the code — that's what makes it safe. Converting "they merged it" into "my read was right" is retroactively claiming a technical judgement I explicitly declined to make.
- ❌ **NOT** every technical inference in the surrounding report. Those stand or fall on their own evidence.

The self-merge dilution caveat (`mergedBy == author` with no independent approval ⇒ weak endorsement) **does not apply here**: the PR author is `nv-slang-bot[bot]` and `ccummingsNV` is an independent MEMBER. Check author-vs-merger before invoking or dismissing that caveat; a bot-authored PR merged by a human is the *opposite* of a self-merge.

## Lesson 2 — before implying a maintainer merged over a pending gate, measure the timing

I drafted "required CI was still pending at decision time — and they merged anyway, which is their call." The "anyway" implied they jumped a red/incomplete gate. Measured:

    decision time 13:13Z : 14 check-runs, 2 queued          → genuinely pending
    last BUILD completed : 13:32:39Z  success
    merge                : 13:32:42Z                        → 3 seconds later
    only post-merge check: 13:33:01Z  board-sync (post-merge automation, not a gate)

So **all 15 checks passed, and every gating build completed before the merge.** The maintainer waited for green and merged immediately on the last build. My "pending" was true *at decision time* and false by merge time — and writing it without the timestamp turned a stale measurement into an unfair implication about a person.

Generalizable: **CI state is a timestamped instant, never a durable property.** When a report spans a state change, attach the instant to every claim and re-measure before shipping. And when a claim reflects on a *human's* judgement, the bar for re-measuring is higher than for a claim about tooling — a stale fact about a script is a bug, a stale fact about a colleague is an accusation. Note also that `completed_at` on a non-gating post-merge check (`board-sync`) sorts *after* the merge and will make a naive `max(completed_at)` look like CI finished post-merge; partition by whether the check is a gate before drawing the conclusion.

## Lesson 3 — when you report a defect's blast radius, COUNT it, don't estimate it

I reported the `devin-fetch.sh` false-clean signature as "approximately eight prior work directories" from a subagent's informal inventory. The critique said 10. I finally *measured* — one loop over `work/*/review/devin-flags.md` testing for a `## Flags` heading with nothing under it:

    TOTAL matching dirs = 23

Nearly 3× my estimate, and the estimate was in the *reassuring* direction. Both the subagent and I had listed the dirs we happened to have seen. The detector is four lines:

    for f in */review/devin-flags.md; do
      after=$(sed -n '/^## Flags/,$p' "$f" | tail -n +2 | tr -d '[:space:]' | wc -c)
      [ "$after" -lt 5 ] && echo "EMPTY-FLAGS: $f"
    done

**A blast radius you eyeballed is not a blast radius.** If a defect is worth reporting, its extent is worth one loop — and an under-count reads as "contained" to whoever decides whether to act. Keep the artifact-vs-decision distinction intact while doing it: 23 dirs share the *artifact-level* signature; whether any consumed a false-clean requires opening each row's `review-doc.md`, which I have not done, so per-row harm remains undetermined. Report the measured count and the undetermined harm together — precision in both directions, not just the cautious one.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785937201358-approver-human-agreement-a-policy-abstain-vindicat.md`_
