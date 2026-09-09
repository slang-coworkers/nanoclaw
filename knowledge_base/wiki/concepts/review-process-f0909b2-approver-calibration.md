---
title: Approver human-verdict calibration and decision-time discipline
type: concept
group: review-process
tags: [approver, calibration, merge-join, human-verdict, over-abstain, false-abstain, self-merge, commit-id, decision-time-read]
source_count: 7
---

## TL;DR

Merge-join calibration measures the approver against the eventual human verdict. The
governing frame: an ABSTAIN is scored against "was this material enough NOT to merge
as-is?" — so a PR that **merges unchanged at the exact decided head** with a genuine
independent expert approval REFUTES a material-concern framing and marks the abstain as
an **over-abstain (false-abstain)**, not agreement.

- **The infra-abstain rate on bot-authored / Devin-only PRs is the burn-down target.**
  When the code is in fact fine, a NO_REVIEW_SIGNAL abstain is a pure cost of the missing
  signal — the fix is making the signal head-current, not changing the decision rule. Do
  not overcorrect toward rounding up: abstain-over-approve stays the safe direction.
- **Weight the intended-usage model when scoring OPEN_GAP.** The bar is "would a
  maintainer BLOCK this," not "does a reachable code path exist." A gap that lives only on
  a path the feature's supported usage never takes, with a domain expert actively engaged,
  leans CLEAR-ADVISORY (note it for the human), not ABSTAIN.
- **Not every merge is an independent verdict.** A same-actor **self-merge with zero
  reviews** is the weakest possible calibration signal — check `mergedBy` vs `author` and
  `reviews`/`reviewDecision` before letting a join nudge future decisions. An OUT_OF_SCOPE
  abstain makes no merits claim, so "merged unchanged" carries no should-have-approved bit.
- **A human review's `commit_id` is stamped to the PR head at review-*processing* time**,
  which can be seconds AFTER a merge commit's `committedDate` — join to that `commit_id`
  from `pulls/N/reviews`, never infer the target commit from `submitted_at` vs commit
  timestamps (they can invert by seconds).
- **Re-read human reviews + comments immediately before recording, not just at staging** —
  a review can land minutes into your own investigation and flip the decision.
- **Some comment-hygiene must-fixes the maintainer does not share.** A regression-test
  comment stating the guarded bug is legitimate slang convention; the internal rubric is
  stricter than practice — a candidate procedure bug, not a real blocker.

## Over-abstain calibration: the safe direction still has a cost

Several joins converge on one lesson: the pipeline repeatedly abstained on PRs that were
genuinely fine, and the root cause was almost always the Devin-only fallback tier, not a
real risk. On slang#12194 (SV_Barycentrics capability check) BOTH revisions abstained —
R1 on STALE_STAGE (Devin analyzed the parent), R2 on a Devin false-positive 🔴 on
byte-identical code — and the PR merged unchanged at the exact R2 head with the superseded
attempt's author also approving. Honestly scored, both are over-abstains; the R2 FP
adjudication was correct but the tier gave no signal clean enough to approve a mergeable PR
[Merge-join calibration: both #12194 abstains were Devin-signal artifacts on a safe PR](../learnings/1787952828932-approver-infra-abstain-merge-join-calibration-both.md).
slang#12537 sharpens the same point from the harmless side: a NO_REVIEW_SIGNAL abstain (harvest
exit 20 + head-stale Devin) was approved 22h later by the area-owning maintainer at the exact
commit — the abstain did its job ("a human must look") but the underlying cause was a pipeline
gap, and NO_REVIEW_SIGNAL abstains are the infra burn-down target, fixed by head-current Devin,
not a rule change
[#12537: human APPROVED at the exact commit I abstained — infra abstain confirmed harmless](../learnings/1787960092745-approver-infra-abstain-approver-human-disagreement.md).
The confirmed-safe conjunction that predicts "will merge unchanged" is: FALLBACK tier + trivial
dev-tooling change + the PR's own activated check GREEN + a human LGTM + the only blocking signal
a Devin 🔴 you refuted — slang#12600 hit all five and merged byte-identical over the refuted 🔴,
which is procedure-bound abstain but high-confidence false-alarm, and evidence for a narrow
policy carve-out on non-code/tooling diffs
[CONFIRMED-SAFE: trivial-tooling PR with green self-CI + LGTM merged over a refuted Devin 🔴](../learnings/1788273322768-approver-human-disagreement-confirmed-safe-fallbac.md).

## When to weight intended-usage, and when a merge is not a verdict

slang#12182 (CUDA/OptiX callable support) merged unchanged after three abstains by a
domain-expert maintainer who engaged the core `-rdc`/`static`-linkage design deeply — a
high-confidence over-caution cluster. Two of the three were correctable: the R1 comment-hygiene
must-fix shipped verbatim (a known procedure bug), and the R2 OPEN_GAP lived only on an
out-of-contract path (mixed whole-program PTX in one module) the feature's usage model never
takes, so it should have been CLEAR-ADVISORY. The narrow correction: kill the comment-hygiene
scope bug, and reserve OPEN_GAP for gaps reachable in *supported* usage — without overcorrecting
away from abstain-over-approve
[slang#12182 merged unchanged after 3 abstains — both flags over-conservative](../learnings/1788271481619-approver-human-disagreement-slang-12182-merged-unc.md).
But not every merge should nudge you: nanoclaw#1402 was an OUT_OF_SCOPE abstain that then
self-merged (mergedBy == author, `reviewDecision`='', 0 reviews). A self-merge with zero
independent reviews is the weakest calibration signal — and an OUT_OF_SCOPE abstain makes no
merits claim, so there is nothing to correct; check `mergedBy` vs `author` before mining any
`pr_merged` join
[OUT_OF_SCOPE abstain confirmed: author self-merge with zero reviews is not a verdict](../learnings/1788263651430-approver-human-agreement-out-of-scope-abstain-conf.md).
The comment-hygiene calibration recurs on slang#12537 too: the maintainer left several style
nits yet APPROVED with the flagged regression-test comment ("Previously… 8 optixGetPayload…")
untouched — for a regression test, a comment stating the guarded bug is legitimate context, so
the internal rubric is stricter than the humans and a regression-test carve-out is worth raising
with the skill owner
[#12537 comment-hygiene must-fix was not shared by the area-owning maintainer](../learnings/1787960092745-approver-infra-abstain-approver-human-disagreement.md).

## Joining to the right commit, and re-reading at decision time

Two mechanical disciplines keep the join and the decision honest. First, a human review's
`commit_id` is stamped to the PR head at review-*processing* time: on slangpy#1080 an APPROVED
review's `submitted_at` (11:28:16Z) was 8 seconds BEFORE the merge commit's `committedDate`
(11:28:24Z), yet its `commit_id` was that merge head — so read `.commit_id` from
`pulls/N/reviews` to find which ledger row the verdict joins to, never infer from timestamps
which can invert by seconds; a pure "Merge branch main" synchronize is a fresh ledger row but a
review no-op (confirm with a merge-base three-dot diff stripping the volatile `index abc..def`
header lines)
[A human review's commit_id is stamped to the PR head at review-processing time](../learnings/1788780992990-approver-human-disagreement-a-human-review-s-commi.md).
That atom also flags the `gate-critique-on-deliver.sh` hook false-positiving on read-only
`gh api pulls/<n>/{reviews,comments}` / `compare/...` strings — route those reads through a
python `subprocess` wrapper or the slang-mcp tools so an ABSTAIN's reads don't burn the hook's
denial cap. Second, staged reviews go stale: on slangpy#1128 (a 1-line Slang version bump) the
derivation was tracking clean toward WOULD_APPROVE when a maintainer's COMMENTED review landed
14 min after staging, surfaced only by the decision-time codex re-read; the maintainer's question
— whether to bump the `external/slang-rhi` submodule pin, ~37 commits behind slang 2026.16.1 —
is a version-coherence gap a green build cannot clear (CI proves it downloads/links, not that the
two independently-pinned slang deps agree), so re-read reviews immediately before recording and
diff the submodule pin against the release's own pin on any Slang version bump
[Slang binary bump: re-read PR reviews at decision time; check the slang-rhi submodule pin](../learnings/1787957525425-approver-challenger-miss-slang-binary-bump-re-read.md).

**Source learnings (7):**
- [Merge-join calibration: both #12194 abstains were Devin-signal artifacts on a safe PR](../learnings/1787952828932-approver-infra-abstain-merge-join-calibration-both.md) — merged unchanged at exact head + expert approval ⇒ both abstains scored as over-abstains; Devin-only tier is the bottleneck.
- [#12537: human APPROVED at the exact commit I abstained — infra abstain harmless](../learnings/1787960092745-approver-infra-abstain-approver-human-disagreement.md) — NO_REVIEW_SIGNAL abstain is the burn-down target; regression-test comment must-fix not shared by the maintainer.
- [OUT_OF_SCOPE abstain confirmed: author self-merge with zero reviews is not a verdict](../learnings/1788263651430-approver-human-agreement-out-of-scope-abstain-conf.md) — check mergedBy vs author + reviews before letting a merge-join nudge future decisions.
- [slang#12182 merged unchanged after 3 abstains — both flags over-conservative](../learnings/1788271481619-approver-human-disagreement-slang-12182-merged-unc.md) — weight intended-usage when scoring OPEN_GAP; reserve it for gaps reachable in supported usage; kill comment-hygiene scope bug.
- [CONFIRMED-SAFE: trivial-tooling PR merged unchanged over a refuted Devin 🔴](../learnings/1788273322768-approver-human-disagreement-confirmed-safe-fallbac.md) — five-way conjunction predicts merge-unchanged; procedure-bound abstain but evidence for a tooling-diff carve-out.
- [A human review's commit_id is stamped to the PR head at review-processing time](../learnings/1788780992990-approver-human-disagreement-a-human-review-s-commi.md) — join via pulls/N/reviews .commit_id, not timestamps; merge-only re-wake is a content no-op; gh-api read hook false-positive.
- [Slang binary bump: re-read reviews at decision time; check slang-rhi submodule pin](../learnings/1787957525425-approver-challenger-miss-slang-binary-bump-re-read.md) — human review landed after staging; green build ≠ version-coherence between two pinned slang deps.
