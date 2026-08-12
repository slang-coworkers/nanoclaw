---
title: "[approver/infra-abstain] slang-rhi has NO github-actions bot review pipeline — harvest exit 10 plus an auth-walled Devin is NO_REVIEW_SIGNAL, not a fallback tier"
type: learning
topic: review-approval
source: learnings/1786084196058-approver-infra-abstain-slang-rhi-has-no-github-act.md
---

# [approver/infra-abstain] slang-rhi has NO github-actions bot review pipeline — harvest exit 10 plus an auth-walled Devin is NO_REVIEW_SIGNAL, not a fallback tier

## Symptom

On shader-slang/slang-rhi#814 I nearly decided a PR with **no valid review tier at all**, because
each individual signal looked like it was almost sufficient.

## The three-part trap (all measured 2026-08-07 at the pinned head)

1. **`github-actions[bot]` produces NO review on slang-rhi.** The `claude-pr-review.yml` /
   claude-code-action pipeline is **slang-only**. On slang-rhi the *only* harvestable bot review is
   CodeRabbit. This is a **repo property, not a harvest failure** — so "no primary review" here
   must not be scored as an infra defect, but it also means the fallback tier is the *only* tier,
   and its quality bar therefore decides everything.
2. **CodeRabbit's review ROW went stale within ~2 minutes.** The PR was opened, CodeRabbit reviewed
   the opened head, then a `synchronize` landed 20 s later. `collect-reviews.sh` → **exit 10**. The
   *inline comments* still anchored at the new head (non-null `position`, `commit_id` rewritten by
   GitHub), and CodeRabbit's summary comment was updated post-push saying "no new actionable
   comments". **None of that is a completed head-current review object** — see the companion
   learning on circular clause inputs.
3. **Devin returned exit 0 with an EMPTY flags section — a FALSE CLEAN.** The page dump carried
   `Sign in` and `90 lines left`, i.e. an unauthenticated/truncated render. Exit 0 + empty findings
   is **not** a clean bill of health. **Demand a positive token** ("N bugs / M flags") **and a
   liveness token** before crediting any reviewer with "found nothing".

⇒ Correct outcome: **`ABSTAIN_INFRA` / `NO_REVIEW_SIGNAL`.** The procedure's own definition — *no
bot review harvested AND Devin failed/absent* — was satisfied exactly.

## Why `ABSTAIN_INFRA` and not `ABSTAIN_POLICY`

After correcting my artifacts, Step 1 *also* carried `CLAUSE_FAIL:commit_match`. That is tempting
to record as `ABSTAIN_POLICY:CLAUSE_FAIL`, and it would be wrong: the clause failure is a
**symptom of the same root cause** (no head-current review exists). `ABSTAIN_POLICY` means "the
system worked as intended, a human should look"; `ABSTAIN_INFRA` means "the pipeline broke and
someone should fix it", and infra rows **alert** and are **excluded from agreement scoring**.
**Filing a real pipeline gap as POLICY disguises a defect as intended behaviour and quietly
deletes the alert.** ⇒ When two reason codes both technically apply, pick the one that names the
**root cause**, not the one the flowchart reached first.

## Repo differences worth carrying (slang vs slang-rhi)

- **Check names carry no coverage information.** Every slang-rhi check is
  `build (os, arch, compiler, config)`; there is no `check-ci` / `wait-for-human-priority` gating
  check as on slang. Coverage lives in `.github/workflows/ci.yml`'s matrix `flags: "unit-test"`
  entries plus the job log.
- **slang-rhi DOES run real GPU tests** on self-hosted `nvrgfx-kernelvm-bridge` runners
  (`./slang-rhi-tests -check-devices`). The doctest tally line is the liveness token, and
  **`0 skipped` is the positive signal** that CUDA-unavailable `SKIP()` guards did not fire.
- **slang-rhi declares NO ABI-stability policy** (checked `docs/api.md`, `README.md`,
  `CONTRIBUTING.md`, `docs/abi.md`), whereas slang's `include/` **is** ABI-stable by written
  policy. **Importing slang's ABI rule into slang-rhi is a silent cross-repo substitution that
  converts a non-issue into a blocker.** Generalization: before applying a policy predicate, check
  it is declared in *this* repo.

## Timing note

A PR opened and force-pushed within minutes produces a **stale review row and a green review-bot
status simultaneously** — the status flipped `success` *after* the push while the review object
stayed pinned to the old head. **A green bot status is never a harvestable review.**

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786084196058-approver-infra-abstain-slang-rhi-has-no-github-act.md`_
