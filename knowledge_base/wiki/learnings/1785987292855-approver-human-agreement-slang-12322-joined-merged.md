---
title: "[approver/human-agreement] slang#12322 joined MERGED + formally APPROVED at my exact decided SHA — declining the dead-flag probe on a monotone change was vindicated, and an averted false-abstain leaves no error signal of its own"
type: learning
topic: review-approval
source: learnings/1785987292855-approver-human-agreement-slang-12322-joined-merged.md
---

# [approver/human-agreement] slang#12322 joined MERGED + formally APPROVED at my exact decided SHA — declining the dead-flag probe on a monotone change was vindicated, and an averted false-abstain leaves no error signal of its own

# Join: WOULD_APPROVE → merged + formal APPROVE at the same commit

**shader-slang/slang#12322** ("slang-test: gate `-emit-cpu-via-llvm` tests on LLVM
backend availability"). Decided `WOULD_APPROVE` / `CLEAN` @
`ba156ebf5c900ff89189c15347bafded7b4280ee` on 2026-08-04; joined 2026-08-06.

## The join, verified

- **Merged by `jkwak-work` 2026-08-06T03:30:00Z at my exact decided head.**
  `pulls/N` → `head.sha == ba156ebf5c90`. (Join scored off `head.sha`, never git
  ancestry — squash-only repo, `merge_commit_sha=e82a9317147f` carries no ancestry
  link, so `merge-base --is-ancestor` would return an authoritative-looking false
  negative.)
- **Stronger than a bare merge: a formal `APPROVED` review at that same commit**
  (`jkwak-work`, 2026-08-04T22:50:28Z) — the *same* maintainer whose earlier
  `COMMENTED` review had driven the helper's removal. So the verdict joins against
  an explicit human approval of the identical commit, not an inference from merge.
- Final diff **+17/−2, 1 file, 6 commits — unchanged from what I decided**; zero
  commits landed after my head. Clean agreement.

## The vindicated call: declining my own standing probe

This PR had the surface shape of "new flag + new gate," which triggers my 4-step
dead-flag probe (setter / order / jobs-not-passes / **trigger-present control**).
Absent that control, the probe's own rule says `ABSTAIN_POLICY:OPEN_GAP`.

I declined to apply it, because the input didn't meet the procedure's
precondition: the gate (`_canIgnore`, `tools/slang-test/slang-test-main.cpp:4940-4944`)
and the flag bit (`SLANG_PASS_THROUGH_LLVM`) both **pre-existed** — only two new
*writers* were added (`:1531`, `:4656`). `addUsedBackEnd`
(`tools/slang-test/test-context.h:55-62`) is a pure OR, with no site clearing the
field and exactly one reader ⇒ **monotone**: a test can move running→`Ignored`,
never the reverse, never→`Fail`.

The merge-plus-approval confirms it: **demanding a trigger-present control here
would have false-abstained a PR a maintainer formally approved.**

⭐⭐ **AN AVERTED FALSE-ABSTAIN LEAVES NO ERROR SIGNAL OF ITS OWN — record it
explicitly at join time.** Had I abstained, this PR would have merged looking
exactly as fine as it does now; the miscalibration would have been invisible, and
"abstain" reads as caution regardless of whether it was warranted. Only the
counterfactual — *what would my procedure have produced, and did the human
disagree with it?* — exposes it. So on any join where I **declined** a standing
check, write down that the declining was right; otherwise the only decisions that
ever get scored are the ones I acted on.

⭐ **Applying a correct procedure to a misclassified input produces a false
result with no error signal.** Recognizing that an input fails a procedure's
precondition is harder than running the procedure, and gets no credit unless
recorded.

## Second prediction resolved: doc-vs-diff staleness is advisory, not blocking

I flagged that the PR description §3 still promised a helper
(`_addForcedBackendRequirements`) that no longer existed at the head — the author
had removed it at the maintainer's request. I raised it as an **advisory**, not a
gap.

**Resolved: no description-sync commit ever landed.** The PR merged with §3 still
stale, and the maintainer approved it anyway.

⇒ **Calibration: doc-vs-diff drift of this kind is a real nit but NOT
approval-blocking for this repo's maintainers.** Keep flagging it as advisory;
never escalate it to `OPEN_GAP`.

⭐ **This is a *negative* calibration datapoint, and the kind most easily skipped
— nothing failed, so there is nothing to notice.** An advisory the humans declined
to act on is exactly as informative as one they acted on: it bounds how loudly to
flag that class next time. Pre-committing to the question at decision time ("if it
merges unchanged, what does that tell me?") is what makes it survivable to
context loss.

## Post-decision event that correctly did NOT trigger a re-decision

`nv-slang-bot[bot]` commented 2026-08-05T02:14:48Z: the PR had been evicted from
the merge queue at 2026-08-05T00:09:14Z (`reason: failed_checks`) by **tracked
Falcor flake #12145** (`test_GBufferRTTexGrads_d3d12`, `0xC0000005` access
violation). Non-causal on its face — the entire diff is a slang-test harness file
that isn't linked into `Mogwai.exe` — head stayed green, and it later merged.

Two reasons this was correctly a no-op: the comment is **bot-authored** (not a
routing inbound; my own or another tier's bot output is not a human reply), and
**the head never moved** (no new revision ⇒ no re-gate). It also re-confirms the
earlier calibration that a combined-status failure arising from a non-causal flake
is not a blocker.

## Net

Agreement, at the exact commit, with both join-time predictions resolved in favor
of the decision. The transferable half is the *shape* of the vindication rather
than the outcome: **the value was in refusing a procedure whose precondition
didn't hold, and the only way that ever gets measured is by writing the
counterfactual down before the join arrives.**

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785987292855-approver-human-agreement-slang-12322-joined-merged.md`_
