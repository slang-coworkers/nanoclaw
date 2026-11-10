---
title: "Approver and CI Operational Notes"
type: concept
group: review-process
tags: [pr-approver, record-decision, head-pinning, mode-staleness, clause-gap, challenger, critique-gate, ci-status, check-suite, human-calibration, human-agreement, human-disagreement, wrong-layer, producer-fix, false-safe, protected-path, memoization-safety]
source_count: 35
---

# Approver and CI Operational Notes

Discipline for turning a harvested review into one auditable decision: pinning and re-verifying the head at record time, reading CI/check-suite/merge-state as a decision input, ordering the clause eval correctly, judging wrong-layer vs. correct-layer fixes, and the human-calibration record of when abstains/blocks/approves matched or missed the maintainer outcome. The review-*input* mechanics (harvest, Devin, delegated-reviewer docs) live in [reviewer pipeline operations](review-pr-reviewer-pipeline-operations.md).

## TL;DR
- **The head can move between analysis and record.** A force-push or synchronize silently stales your pinned SHA; re-pin the live head at record time and byte-prove the review against it.
- **`mode` can go stale too.** Human reviews posted during a long Devin wait flip `live`↔`live_late`; re-check `gh pr view --json reviews` at record time.
- **A merge/review JOIN is a claim, not evidence.** Verify against live GitHub; refuse `record_human_verdict` when the merge SHA doesn't resolve.
- **On a CI-failed tasking event, re-pin to the settled head** — the failure is often already fixed.
- **Tell same-run re-report from a real new red by JOB IDS** — a second `[CI failed — new check_suite]` at a decided head is a re-classification trigger, not a new revision.
- **Devin-clean is not test-clean.** Never record WOULD_APPROVE while CI is pending on a behavior-changing PR; new hard-error diagnostics can break untouched tests, and on a Devin-only tier CI is the only catch.
- **Static "0 bugs" is weak on CI-matrix / wheel changes**; protected `.github/**` ABSTAIN is well-calibrated for this class.
- **BLOCKED + all green + APPROVED is a branch-protection gate** (last-pusher rule, unresolved human thread), not CI — don't churn reruns. `license/cla` not_signed on bot PRs is a soft gate; `BEHIND` alone is harmless.
- **Build the review doc before evaluating clauses** — else `commit_match` is unevaluable.
- **Safe ≠ right.** A "drop the no-op before emit" patch may be safe yet wrong-layer; ask whether the producer should be fixed. "Safe by construction" is a hypothesis that can be WRONG.
- **A refuted 🔴 does not round up, and a predating human approval does not license rounding up a source-verified 🔴.**
- **Calibration is bidirectional.** Maintainers ship net-positive incremental hygiene fixes (OPEN_GAP abstains on dev-tooling are often over-cautious) and self-merge through a red aggregate gate when the only red is confirmed infra-flake. BLOCKs on real latent gaps and PR-caused red CI have been vindicated by fix-then-merge.

## Head pinning and record-time re-verification

Everything staged during analysis is against a specific head, and that head is not stable. On slang#12136 the full harvest+Devin+challenger+DECISION_REVIEW ran against a 15-min-quiet head that a force-push had already replaced, so the ledger payload was drafted against a stale SHA ([force-push staled my SHA](../learnings/1784184019511-approver-challenger-miss-re-pin-the-head-at-record.md)); on #12138 a synchronize superseded the pin mid-analysis ([synchronize supersedes pin](../learnings/1784223025561-approver-clause-gap-re-check-live-pr-head-at-recor.md)). Re-pin and re-verify the live head at record time, not only at analysis start.

The same staleness hits the human-review signal and `mode`: on slangpy#1002 R2 reviews were empty when `mode=live` was staged, but a long Devin wait gives humans time to post — re-check `gh pr view --json reviews` at record time ([mode goes stale](../learnings/1784152510275-approver-clause-gap-re-check-human-reviews-at-reco.md)). A merge/review JOIN handed to you ("MERGED by X, human verdict=APPROVED, call record_human_verdict") is a claim to verify against live GitHub — refuse `record_human_verdict` when the merge SHA doesn't resolve ([JOIN is a claim](../learnings/1784114374872-approver-human-disagreement-a-merge-review-join-ev.md)). A CI-failed *tasking* event usually names a commit already fixed by decision time — re-pin to the settled head ([CI-failed tasking already fixed](../learnings/1784138155920-approver-clause-gap-a-ci-failed-tasking-event-is-o.md)).

## CI and check-suite status as a decision input

CI state is a first-class verdict input and needs job-level detail. A second `[CI failed — new check_suite]` event at an already-decided head is a re-classification trigger; compare job IDs to tell a same-run re-report (distinct suite ID re-rolling the same failure) from a real new red ([check job IDs](../learnings/1784142064176-approver-clause-gap-a-ci-failed-new-check-suite-ev.md)). A mechanically-red required aggregate gate is not automatically a blocker: maintainers confirmed-self-merge THROUGH a red `check-ci` when the only red is confirmed infra-flake (e.g. aarch64-only apt/`ports.ubuntu.com` network failures) ([self-merge through infra-flake red](../learnings/1784146233401-approver-human-disagreement-confirmed-maintainers-.md)).

Conversely, a clean static review does not clear behavior-changing code while CI is pending. On slang#12122 a WOULD_APPROVE was nearly recorded @9fe3de9e with CI pending ([never approve with CI pending](../learnings/1784150830548-approver-false-safe-never-record-would-approve-whi.md)); on #11595 a new hard-error diagnostic (E41303) broke pre-existing untouched tests, and on the Devin-only tier the CI gate was the only catch ([hard-error diagnostics break untouched tests](../learnings/1784185856147-approver-challenger-miss-averted-new-hard-error-di.md)). CI-matrix / wheel changes are the sharpest case: only running the matrix finds build breaks across added Python versions, toolchain bumps, or matrix combos ([static 0-bugs weak on matrix](../learnings/1784158778419-approver-human-disagreement-ci-matrix-wheel-change.md)). When red CI is genuinely PR-caused, BLOCK is right — #12130 (GLSL float-remainder / SPIR-V OpFMod) was vindicated by fix-then-merge ([BLOCK on PR-caused red](../learnings/1784177389034-approver-human-agreement-block-on-pr-caused-red-ci.md)).

### BLOCKED with everything green is a maintainer gate

When a PR reads `mergeable: MERGEABLE` but `mergeStateStatus: BLOCKED` while every check is green, `reviewDecision: APPROVED`, and 0 unresolved threads, the blocker is **branch protection / an admin gate** — don't churn CI reruns or re-investigate tests. Most common trigger (slang#13021): the **sole approver is also the most-recent pusher**, so "require approval of the most recent push by someone other than the pusher" stays unsatisfied — e.g. a maintainer hand-applied files the bot couldn't push (`.github/workflows/*` without the App `workflows` scope), *became* last pusher (dismissing their earlier approval), and re-approving left them last-pusher + sole-approver. Confirm by comparing the head commit's `author`/`committer` against the approver and approval `submitted_at`. The integration **cannot read branch protection** (403 "not accessible by integration"), so report the rule as a *labeled hypothesis* and let the maintainer resolve it (a second non-pusher approval, or admin-merge) — never summon a specific human through a side channel. Prevention: let the bot push ALL of a PR's files so it stays last pusher. Also: a flaky leg you were green-lit to rerun may **already be green** (auto-rerun / someone else) — check `gh run view --json jobs` / `gh api .../check-runs` before spending attempts ([BLOCKED+green = maintainer gate](../learnings/1789218490824-pr-blocked-with-all-checks-green-approved-maintain.md); [hand-applying makes maintainer last pusher](../learnings/1789218545131-a-maintainer-hand-applying-a-bot-s-changes-can-blo.md)).

A second cause of the same shape is **require-conversation-resolution**: a PR APPROVED (even by several maintainers) with green CI stays BLOCKED because a reviewer left an inline change-request, then approved, but never resolved the thread (`isResolved:false`) even though HEAD implements it (slang-rhi#852). Diagnose via GraphQL `pullRequest.reviewThreads.nodes { isResolved isOutdated path line }`; `/branches/<b>/protection` is 403 for the App token, so infer the rule from unresolved-thread + approvals + green CI. Do NOT resolve a human maintainer's thread yourself (policy: resolve LLM/bot threads only; a human's resolution is theirs or the merger's call, and an operator-gated write). Instead post a factual threaded reply — `POST /repos/{o}/{r}/pulls/{n}/comments/{comment_id}/replies` body "Addressed in <sha> — <what changed>. CI green." — a pre-authorizable "your comment is implemented" class that prompts resolution. A PR merely `BEHIND` an unrelated base commit is harmless when `MERGEABLE` and CI validates the merge ref — don't force-push a rebase (a gated write); "Update branch" handles it at merge ([unresolved human thread blocks merge](../learnings/1789499918969-approved-pr-can-still-be-merge-blocked-by-an-unres.md)).

On bot-authored PRs, `license/cla` PENDING / `not_signed` (CLAassistant: "author has not signed") looks like a hard blocker but is a **soft gate** — maintainers merged 6 `nv-slang-bot[bot]` PRs Sep 2–11 2026 despite it; a bot cannot self-sign. Report it once as FYI. The real blocker is usually `reviewDecision: REVIEW_REQUIRED` with 0 human reviews (maintainer attention), not CLA or CI infra ([CLA soft gate](../learnings/1789183755022-slang-bot-authored-prs-license-cla-not-signed-is-a.md)).

## Ordering the clause eval and review-doc synthesis

On #12126 running `eval-clauses.py` *before* synthesizing the review doc left `commit_match` unevaluable, because synthesis populates the field the clause reads. Synthesize the review doc first, then evaluate clauses ([eval-clauses order](../learnings/1784147694801-approver-critique-mustfix-eval-clauses-before-revi.md)).

## Codegen-inert re-review must use a true two-dot diff

Under a "codegen-inert synchronizes ride the recorded decision" rule (slang#12080), a synchronize can look like doc/test polish while a rebase hides real codegen changes. Use a TRUE two-dot content diff — a three-dot or `gh` compare view after a rebase can falsely read as inert ([two-dot diff](../learnings/1784187594343-approver-clause-gap-codegen-inert-check-must-use-a.md)).

## Wrong-layer vs. correct-layer: producer fixes and diagnostic safety

Safe is not right. slang#11323's pre-emit pass `eliminateCastToVoid` dropped a `kIROp_CastToVoid` no-op because no backend handles it — safe, but the producer should be fixed instead (wrong-layer rejection) ([safe ≠ right](../learnings/1784109134516-approver-challenger-miss-drop-a-no-op-before-emit-.md)). The correct-layer redo #12117 lowers `(void)expr` to the canonical void value at the producer; a "produced-once/consumed-nowhere/emitted-nowhere" op is cleared by proving it is no longer MATERIALIZED, not merely dropped downstream ([prove not materialized](../learnings/1784113889947-approver-confirmed-safe-correct-layer-producer-fix.md)). The arc closed cleanly: #11323 abstained (CHANGES_REQUESTED) → #12117 approved, MERGED byte-identical + human APPROVED — a producer-fix redo of a rejected symptom-patch is a strong clean-approve prior ([#11315 arc closed](../learnings/1784194721856-approver-human-agreement-11315-arc-closed-wrong-la.md)).

"Safe by construction" is a hypothesis that can fail: slang#12122's parse-time CLI-rejection diagnostic (E00046) was claimed safe because it defers to the emitter's own fold ([claimed safe](../learnings/1784146073220-approver-challenger-confirmed-new-cli-rejection-di.md)), and that was retracted as WRONG in the same session ([correction](../learnings/1784150857406-approver-false-safe-correction-to-earlier-12122-ch.md)). The pattern and its correction together are the lesson.

## The challenger must escalate a verified crash even from a 0-bug review

A 0-bug production review can still name a prose "main concern" that is a verified crash. On slang#12136 an ABSTAIN_POLICY:CHALLENGER_CONCERN was recorded on the fallback tier (the production review timed out IN_PROGRESS through the exit-22 WAIT window), but the primary review's "main concern" was a real crash — the challenger must escalate it, and a late primary review supersedes a fallback ABSTAIN ([0-bug main concern is a crash](../learnings/1784187296919-approver-decision-flip-a-0-bugs-primary-review-s-o.md)).

## Calibration: protected paths draw long human review cycles

Protected `.github/**` (CI/workflow tooling) reliably draws a long human cycle even with a bug-clean bot review, so ABSTAIN_POLICY there is well-calibrated — confirmed on #12086 (compile-perf reporting redesign touching two `.github/workflows/*.yml`) ([protected-path abstain calibrated](../learnings/1784111097033-approver-human-disagreement-confirmed-protected-pa.md)). It earns its keep on what static review misses: a human caught build-matrix failures on a wheels-matrix change ([human wheels-matrix catch](../learnings/1784158964544-approver-calibration-protected-github-abstain-vali.md)).

## Calibration: over-cautious OPEN_GAP abstains on dev-tooling

Maintainers ship net-positive incremental hygiene fixes even when a PR misses its titular scope: slang#12118 ("read suite files as explicit UTF-8 everywhere") missed 3 same-class bare `open()` reads yet merged unchanged at the decision head ([titular-scope OPEN_GAP over-cautious](../learnings/1784141883615-approver-human-disagreement-titular-scope-incomple.md)). Two stale Architecture-table rows in a demo README (slang#12090) shipped via author self-merge ([doc-inconsistency shipped](../learnings/1784111092025-approver-human-disagreement-demo-example-doc-incon.md)). Latent-bug gaps in dev-only release tooling are merged knowingly (slangpy#1065 "Merge 0.43.0"), so ABSTAIN_POLICY aligns and this class rarely warrants BLOCK ([release-tooling gaps merged knowingly](../learnings/1784150237934-approver-human-disagreement-latent-bug-gaps-in-dev.md)).

Withholding on SAFE is agreement, not false-safe: slang#12064 (external-fork SPIR-V Flat-decoration fix), ABSTAIN_POLICY/OPEN_GAP for a missing negative test, merged byte-identical at the decided head with the gap unaddressed ([withhold-on-SAFE agreement](../learnings/1784178323358-approver-human-agreement-terminal-confirm-slang-12.md)). A close is not automatically a defect signal: an AUTHOR close-unmerged as "obsoleted by future refactoring" (#12109, SpecializationWorkList-via-scratchData, WOULD_APPROVE @00bdbc62) is strategic-obsolete, not defect-rejection — distinguish before scoring ([author close not false-safe](../learnings/1784268042791-approver-human-agreement-closed-unmerged-by-the-au.md)).

## Calibration: BLOCK and clean-approve vindications

BLOCKs on real latent defects have been vindicated by pre-merge fixes: slang#11979 (shader-coverage-backends) — the author added the exact payload-validation guard ([latent-gap BLOCK vindicated](../learnings/1784141964975-approver-human-agreement-block-on-a-latent-but-rea.md)); slang#12106 — a memoization BLOCK→fix→APPROVE chain whose fix commit title named the implicated cache (csyonghe APPROVED there) ([memoization BLOCK chain](../learnings/1784172597183-approver-human-agreement-full-merge-trajectory-vin.md)).

Clean approves confirm too: slang#12052's module-scoped `SharedSemanticsContext` seeding (extension-visibility fix) merged byte-identical to the approved diff (jkwak-work APPROVED) ([SharedSemanticsContext confirmed](../learnings/1784167332666-approver-human-agreement-confirmed-safe-module-sco.md)); a bot-fixer Devin-only WOULD_APPROVE (#12128; production `claude-pr-review.yml` skips bot fixer branches) was vindicated after the challenger closed the Devin-coverage gap by direct inspection ([Devin-only approve vindicated](../learnings/1784173400438-approver-human-agreement-bot-fixer-devin-only-woul.md)). Counter-rule: a human approval that *predates* the production finding never rounds up a source-verified 🔴 — on #11471, `reviewDecision=APPROVED` (jkwak-work "Looks good to me." 2026-07-13, so `mode=live_late`) did not license it ([predating approval](../learnings/1784166450120-approver-human-disagreement-a-human-approval-that-.md)).

---

**Source learnings (35):**

- [wrong-layer no-op drop: safe ≠ right](../learnings/1784109134516-approver-challenger-miss-drop-a-no-op-before-emit-.md)
- [demo doc-inconsistency OPEN_GAP shipped via self-merge](../learnings/1784111092025-approver-human-disagreement-demo-example-doc-incon.md)
- [protected-path `.github/**` ABSTAIN well-calibrated](../learnings/1784111097033-approver-human-disagreement-confirmed-protected-pa.md)
- [producer fix: prove op no longer MATERIALIZED](../learnings/1784113889947-approver-confirmed-safe-correct-layer-producer-fix.md)
- [merge/review JOIN is a claim to verify](../learnings/1784114374872-approver-human-disagreement-a-merge-review-join-ev.md)
- [CI-failed tasking event often already fixed](../learnings/1784138155920-approver-clause-gap-a-ci-failed-tasking-event-is-o.md)
- [titular-scope OPEN_GAP on dev-tooling over-cautious](../learnings/1784141883615-approver-human-disagreement-titular-scope-incomple.md)
- [latent payload-validation BLOCK vindicated](../learnings/1784141964975-approver-human-agreement-block-on-a-latent-but-rea.md)
- [new check_suite event: compare job IDs](../learnings/1784142064176-approver-clause-gap-a-ci-failed-new-check-suite-ev.md)
- [CLI-rejection diagnostic "safe by construction" (later retracted)](../learnings/1784146073220-approver-challenger-confirmed-new-cli-rejection-di.md)
- [self-merge through infra-flake red check-ci](../learnings/1784146233401-approver-human-disagreement-confirmed-maintainers-.md)
- [eval-clauses before synthesis leaves commit_match unevaluable](../learnings/1784147694801-approver-critique-mustfix-eval-clauses-before-revi.md)
- [dev-only release-tooling gaps merged knowingly](../learnings/1784150237934-approver-human-disagreement-latent-bug-gaps-in-dev.md)
- [never WOULD_APPROVE with CI pending](../learnings/1784150830548-approver-false-safe-never-record-would-approve-whi.md)
- [correction: #12122 "safe by construction" was wrong](../learnings/1784150857406-approver-false-safe-correction-to-earlier-12122-ch.md)
- [re-check human reviews at record time](../learnings/1784152510275-approver-clause-gap-re-check-human-reviews-at-reco.md)
- [CI-matrix wheel changes: static 0-bugs weak](../learnings/1784158778419-approver-human-disagreement-ci-matrix-wheel-change.md)
- [protected-path abstain validated by human matrix catch](../learnings/1784158964544-approver-calibration-protected-github-abstain-vali.md)
- [predating human approval doesn't round up 🔴](../learnings/1784166450120-approver-human-disagreement-a-human-approval-that-.md)
- [SharedSemanticsContext seeding merged byte-identical](../learnings/1784167332666-approver-human-agreement-confirmed-safe-module-sco.md)
- [memoization BLOCK→fix→APPROVE vindicated](../learnings/1784172597183-approver-human-agreement-full-merge-trajectory-vin.md)
- [bot-fixer Devin-only approve vindicated](../learnings/1784173400438-approver-human-agreement-bot-fixer-devin-only-woul.md)
- [BLOCK on PR-caused red CI vindicated (#12130)](../learnings/1784177389034-approver-human-agreement-block-on-pr-caused-red-ci.md)
- [slang#12064 withhold-on-SAFE agreement](../learnings/1784178323358-approver-human-agreement-terminal-confirm-slang-12.md)
- [re-pin head at record time (force-push)](../learnings/1784184019511-approver-challenger-miss-re-pin-the-head-at-record.md)
- [new hard-error diagnostics break untouched tests](../learnings/1784185856147-approver-challenger-miss-averted-new-hard-error-di.md)
- [0-bugs "main concern" can be a crash; escalate](../learnings/1784187296919-approver-decision-flip-a-0-bugs-primary-review-s-o.md)
- [codegen-inert check needs two-dot diff](../learnings/1784187594343-approver-clause-gap-codegen-inert-check-must-use-a.md)
- [#11315 arc closed: producer-fix redo is clean-approve prior](../learnings/1784194721856-approver-human-agreement-11315-arc-closed-wrong-la.md)
- [re-check live head at record time (synchronize)](../learnings/1784223025561-approver-clause-gap-re-check-live-pr-head-at-recor.md)
- [author close as obsolete is not false-safe](../learnings/1784268042791-approver-human-agreement-closed-unmerged-by-the-au.md)
- [BLOCKED+green+APPROVED = maintainer gate](../learnings/1789218490824-pr-blocked-with-all-checks-green-approved-maintain.md)
- [maintainer hand-apply → last-pusher block](../learnings/1789218545131-a-maintainer-hand-applying-a-bot-s-changes-can-blo.md)
- [bot PR license/cla not_signed is soft gate](../learnings/1789183755022-slang-bot-authored-prs-license-cla-not-signed-is-a.md)
- [unresolved human thread blocks approved PR](../learnings/1789499918969-approved-pr-can-still-be-merge-blocked-by-an-unres.md)
