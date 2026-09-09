---
title: Approver eligibility clauses, harvest exit codes, and the bot-PR class
type: concept
group: review-process
tags: [approver, eval-clauses, commit-match, harvest, collect-reviews, exit-20, author-trust, tier-eligible, reason-code, infra-abstain]
source_count: 13
---

## TL;DR

The slang/slangpy PR-approver decides in ordered stages: Step-1 eligibility **clauses**
(data-only: `author_trust`, `tier_eligible`, `no_protected_paths`, `head_provenance`,
`ci_green_on_sha`, `commit_match`) → Step-2 verdict parse → Step-3 challenger (runs only
if 1–2 pass) → Step-4 record. Two infrastructure surfaces produce spurious *infra*
reason_codes if you fight the ordering; the fix is procedural, not a decision change.

- **Run `eval-clauses.py` AFTER synthesizing `review/review-doc.md`.** `commit_match`
  parses the embedded `_approver_result.commit_id` from the DOC, not `harvest.json`. Run
  early and it reports `commit_match: unevaluable` → `CLAUSE_UNEVALUABLE:commit_match`, an
  **infra** reason_code that alerts and burns down the infra-abstain gate — even though
  harvest already holds the matching commit_id. Order: harvest → Devin → synthesize doc →
  eval-clauses. If you peeked early, re-run after the doc exists. (Recorded four separate
  times — treat it as settled procedure.)
- **A real Step-1 CLAUSE_FAIL (policy) dominates a CLAUSE_UNEVALUABLE (infra).** When you
  short-circuit a bot-authored PR before synthesizing the doc, `commit_match` shows
  unevaluable — ignore it and record the policy `CLAUSE_FAIL:<name>`, never NO_REVIEW_SIGNAL.
- **Exit 20 from `collect-reviews.sh` is not always a genuine skip.** It conflates four
  distinct states: (a) production review still `in_progress`; (b) production review RAN and
  FAILED (>300-file diff → HTTP 406 `too_large`); (c) CodeRabbit posted only a summary
  issue-comment, no review object; (d) a true skip of a bot/fixer branch. Independently
  probe check-runs and CodeRabbit before trusting Devin-only.
- **A `synchronize`/rebase can change what the surface signals cannot see.** Compare the
  bot-reviewed commit vs pinned head (`compare/<bot>...<head>`); if `diverged`, diff the
  *file sets* — a rebase that drops its own tests is an OPEN_GAP a "no actionable comments"
  summary structurally cannot report.
- **The bot-authored PR class is a foregone author_trust abstain.** `nv-slang-bot[bot]` is
  CONTRIBUTOR/NONE, never in the trusted set {OWNER, MEMBER, COLLABORATOR}; oversized syncs
  also fail `tier_eligible`. Run clauses FIRST and skip the Devin/harvest spend — the review
  signal cannot rescue a clause fail. This is WORKING AS INTENDED, not a pipeline defect.

## The eval-clauses ordering artifact (recorded four times)

Four independent sessions hit and recorded the same trap, which makes it a settled rule:
`eval-clauses.py`'s `commit_match` predicate reads the `commit_id` embedded in
`review/review-doc.md`'s `_approver_result` block, and does **not** fall back to
`harvest.json`. Run it before Step-1b synthesizes the doc and it returns `unevaluable`
("review doc absent or carries no commit_id") — a pure step-ordering artifact with nothing
to do with the PR, yet `CLAUSE_UNEVALUABLE` classifies as an **infra** reason_code that the
quality gate is driven to ~0, so recording it verbatim mislabels a clean policy abstain as a
pipeline defect. The first record (slang#12769) showed it flipping to `pass` with a real
`diff_hash` once the doc existed
[eval-clauses commit_match is unevaluable until review-doc.md exists](../learnings/1788240930555-approver-infra-abstain-eval-clauses-commit-match-i.md);
slang#12542 named the exact remedy — synthesize the doc, then re-run so clauses read 5 pass
/ 1 fail (author_trust) / 0 unevaluable, and record the genuine gating clause
[Run eval-clauses AFTER synthesizing review-doc.md, or commit_match falsely reads UNEVALUABLE](../learnings/1788247676444-approver-infra-abstain-run-eval-clauses-after-synt.md);
slang#12656 confirmed harvest.json carrying the matching commit_id is not enough — the doc
is the source
[eval-clauses.py reads commit_id from review-doc.md — run it AFTER synthesizing](../learnings/1788370290784-approver-clause-gap-eval-clauses-py-reads-commit-i.md);
and slang#12889 shows the check that distinguishes artifact from real gap: if
`harvest.json.commit_id == tmp/context.json.commit_sha` and `stale=false`, the unevaluable
is ordering, not infra
[Run eval-clauses AFTER synthesizing review-doc.md — commit_match reads the doc, not harvest.json](../learnings/1788394397905-approver-clause-gap-run-eval-clauses-after-synthes.md).
A related caveat that recurs alongside these: `eval-clauses.py`'s `ci_green_on_sha` reads
the legacy combined-status endpoint (StatusContexts only), which is **blind to Actions
check-runs** — always independently enumerate `statusCheckRollup` before trusting a green.

## Harvest exit 20 is overloaded

`collect-reviews.sh` returning exit 20 (`{"found": false}`) is documented as "no harvestable
bot review AND none pending → fall to Devin-only," but it collapses several distinct
realities. On a **fresh** PR the production `review` check-run can still be `in_progress`:
slang#12809 returned exit 20 while the github-actions `review` check ran, completing `success`
three minutes later with the primary review — so before accepting exit 20 on a recently-opened
PR, query the head's check-runs and WAIT + re-harvest if `review` is in_progress (treat as
exit 22)
[collect-reviews exit 20 can hide an in_progress production review check-run](../learnings/1787913333461-approver-infra-abstain-collect-reviews-exit-20-can.md).
On a **large** PR the production review can have RUN and FAILED: slang#12846 (~972 files) tripped
GitHub's `.diff` media-type limit (>300 files → HTTP 406 `too_large`) at the "Pre-stage PR diff"
step, so no review was posted and harvest could not distinguish infra failure from a skip — this
is substantively exit-21 and should record the primary review as infra-*absent*, not skipped
[harvest exit-20 conflates a FAILED production review with a genuine skip (>300 files → 406)](../learnings/1788161149996-approver-infra-abstain-harvest-exit-20-conflates-a.md).
And a green **CodeRabbit** status is not a harvestable review: on slang#12872 exit 22 →
CodeRabbit status pending→success → re-harvest exit 20, because CodeRabbit finished its run
without posting a review object — this is the correct fall-through to Devin-only, not an infra
failure
[CodeRabbit commit-status=success can coexist with zero harvestable review (22→20)](../learnings/1788294962668-approver-harvest-coderabbit-commit-status-success-.md).
The deepest of these is a script bug: on slang#12975 CodeRabbit completed cleanly on the exact
head ("No actionable comments 🎉") but posted only a **summary issue-comment**, and
`collect-reviews.sh`'s `if not cand:` branch fires *before* consulting the captured `cr_summary`,
discarding the clean secondary signal → exit 20. On a clause-passing PR whose only signal is
that summary, this yields a spurious Devin-only fall (and a spurious NO_REVIEW_SIGNAL if Devin
also fails); cross-check CodeRabbit's comments + commit statuses directly before trusting
Devin-only
[collect-reviews.sh exit 20 drops a clean CodeRabbit summary-comment review](../learnings/1788912218187-approver-infra-abstain-collect-reviews-sh-exit-20-.md).

## Synchronize that drops its own tests, and the bot-PR clause-fail class

A `synchronize` decision must be diffed at the file-set level, not the surface signal. On
slangpy#1129 a rebase (18cf8bd→80aebfa4, `diverged`) *removed* `tests/sgl/core/test_hash.cpp`
and its CMake registration — so the defining delta of the revision under decision was the
DELETION of its own coverage, while CodeRabbit's clean summary was stale (blessed the tested
commit) and Devin is structurally silent on an absent test. That is a nameable
ABSTAIN(OPEN_GAP), never rounded up, and it extends the "no test doesn't make the code wrong
answers the wrong question" shape
[synchronize that drops its own tests is an OPEN_GAP a stale bot review can't see](../learnings/1788102710919-approver-clause-gap-synchronize-that-drops-its-own.md).

For bot-authored PRs the decision is decided by data-only clauses before any review signal
enters. A GitHub App bot (`nv-slang-bot[bot]`) has `author_association` NONE/CONTRIBUTOR — never
in the trusted set — so `author_trust` FAILs and Step-1 short-circuits before the verdict parse
and challenger. On a companion PR (slangpy#1135) Devin ran clean and the synthesized verdict was
APPROVE, yet the decision was ABSTAIN_POLICY:CLAUSE_FAIL:author_trust — a foregone outcome, so the
harvest+Devin build was moot work; the cheap up-front read is `gh api .../issues/<pr> --jq
.author_association` (the issues endpoint doesn't trip the PR-creation critique hook)
[Bot-authored companion PRs abstain at author_trust before any review signal](../learnings/1788481930442-approver-policy-behavior-bot-authored-companion-pr.md).
Oversized **sync** PRs pile on `tier_eligible` (thousands of lines ≫ the v0-shadow 400-line/30-file
cap) and often `no_protected_paths` (`.github/**`, `**/*.yml`) — run `eval-clauses.py` FIRST and
STOP on the fail, recording every hard fail in the reason_code
[Bot-authored upstream-sync PRs are a dispositive clause-fail class — clauses before Devin](../learnings/1788442495371-approver-process-bot-authored-upstream-sync-prs-ar.md),
[Short-circuit Devin on a Step-1 data-only clause FAIL](../learnings/1788880115462-approver-procedure-short-circuit-devin-on-a-step-1.md).
Crucially, an eligibility CLAUSE_FAIL always beats a Step-2 review 🔴: on slang#12834 the
Devin-only review flagged a real-looking 🔴 (REQUEST_CHANGES), but the decision was still
ABSTAIN_POLICY:CLAUSE_FAIL:author_trust because Step-2's "any 🔴 ⇒ BLOCK" only runs after Step-1
fully passes — do not "upgrade" a clause-fail abstain to BLOCK; instead surface the pre-empted
🔴 (file:line) in the human-facing report while recording the operative clause
[A Step-1 clause FAIL pre-empts a Step-2 review BLOCK verdict](../learnings/1788552456784-approver-procedure-a-step-1-clause-fail-pre-empts-.md).

**Source learnings (13):**
- [collect-reviews exit 20 can hide an in_progress production review check-run](../learnings/1787913333461-approver-infra-abstain-collect-reviews-exit-20-can.md) — probe head check-runs on a fresh PR; wait + re-harvest if `review` is in_progress (exit 22, not 20).
- [harvest exit-20 conflates a FAILED production review with a genuine skip](../learnings/1788161149996-approver-infra-abstain-harvest-exit-20-conflates-a.md) — >300-file diff → HTTP 406 too_large fails the reviewer; record primary review as infra-absent, not skipped.
- [CodeRabbit commit-status=success can coexist with zero harvestable review (22→20)](../learnings/1788294962668-approver-harvest-coderabbit-commit-status-success-.md) — green CodeRabbit status ≠ posted review object; correct fall to Devin-only, not infra failure.
- [collect-reviews.sh exit 20 drops a clean CodeRabbit summary-comment review](../learnings/1788912218187-approver-infra-abstain-collect-reviews-sh-exit-20-.md) — `if not cand:` fires before consulting cr_summary; cross-check CodeRabbit comments/statuses on a clause-passing PR.
- [eval-clauses commit_match is unevaluable until review-doc.md exists](../learnings/1788240930555-approver-infra-abstain-eval-clauses-commit-match-i.md) — synthesize doc first; unevaluable+harvest-matched is an ordering artifact, not CLAUSE_UNEVALUABLE.
- [Run eval-clauses AFTER synthesizing review-doc.md (author_trust decisive)](../learnings/1788247676444-approver-infra-abstain-run-eval-clauses-after-synt.md) — re-run post-synthesis; record the genuine gating clause, never the ordering-induced unevaluable.
- [eval-clauses.py reads commit_id from review-doc.md — run it AFTER synthesizing](../learnings/1788370290784-approver-clause-gap-eval-clauses-py-reads-commit-i.md) — commit_id sourced from the doc, not harvest.json; verify commit_match=pass before recording.
- [Run eval-clauses after synthesizing — commit_match reads the doc, not harvest.json](../learnings/1788394397905-approver-clause-gap-run-eval-clauses-after-synthes.md) — unevaluable+harvest.commit_id==pinned & stale=false ⇒ ordering artifact; only genuine policy fails stand.
- [synchronize that drops its own tests is an OPEN_GAP a stale bot review can't see](../learnings/1788102710919-approver-clause-gap-synchronize-that-drops-its-own.md) — compare bot commit vs head; diff file sets; a rebase deleting its own tests is a nameable ABSTAIN(OPEN_GAP).
- [Bot-authored upstream-sync PRs are a dispositive clause-fail class](../learnings/1788442495371-approver-process-bot-authored-upstream-sync-prs-ar.md) — run clauses before spending Devin; author_trust + tier_eligible fail by construction; WORKING AS INTENDED.
- [Bot-authored companion PRs abstain at author_trust before any review signal](../learnings/1788481930442-approver-policy-behavior-bot-authored-companion-pr.md) — cheap `issues/<pr> --jq .author_association` read up front; POLICY not infra; ci_green blind to CheckRuns.
- [A Step-1 clause FAIL pre-empts a Step-2 review BLOCK verdict](../learnings/1788552456784-approver-procedure-a-step-1-clause-fail-pre-empts-.md) — eligibility fail beats a review 🔴; record the clause, surface the pre-empted bug for the human.
- [Short-circuit Devin on a Step-1 data-only clause FAIL](../learnings/1788880115462-approver-procedure-short-circuit-devin-on-a-step-1.md) — run eval-clauses before Devin; a real CLAUSE_FAIL dominates CLAUSE_UNEVALUABLE; not NO_REVIEW_SIGNAL.
