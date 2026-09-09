---
title: Harvesting bot reviews — collect-reviews.sh, CodeRabbit surfaces, exit codes, and races
type: concept
group: review-process
tags: [approver, collect-reviews, harvest, coderabbit, exit-20, exit-21, exit-10, exit-22, pagination, race, tier]
source_count: 10
---

## TL;DR

The PR-approver's tier classification (primary / fallback / Devin-only) rests on
`collect-reviews.sh` / `harvest-reviews.py` correctly detecting the bot reviews present at the
pinned head. That collector has a family of defects that all fail the SAME direction — they
report LESS review coverage than exists, wrongly demoting a reviewed PR to Devin-only or to
NO_REVIEW_SIGNAL. Because a demotion looks conservative, it slips through unless you probe it.

The exit-code map and its traps:

- **exit 20 = "no harvestable bot review AND none pending."** Recurring false positive:
  CodeRabbit posts its whole review (and its "No actionable comments generated 🎉" clean verdict)
  as a GitHub ISSUE COMMENT on shader-slang/slang, not a formal `pulls/N/reviews` object — which
  the collector reads only. Also fires as a RACE (the production `github-actions[bot]` review
  lands seconds after the harvest) and via a non-paginated check-runs fetch (a pending `review`
  run on page 2 of >30 check-runs is invisible).
- **exit 22 = "a review bot is pending" ⇒ WAIT, re-harvest.** The correct code when a `review` /
  claude / coderabbit check-run is `in_progress`/`queued`.
- **exit 10 = "stale review only" (a formal review object pinned to an older head).** On a FRESH
  push it is a pending-bot SUSPECT even when `pending_bot: null` — the bot simply hasn't re-run
  on the new head yet.
- **exit 21 = ABSTAIN_INFRA (comments-fetch failed).** On any PR with >100 reviews this is the
  KNOWN OneCLI-proxy `--paginate` 401 defect, NOT genuine absence — hand-page GraphQL before
  accepting it.

**The universal guard:** a negative branch reached by fall-through is the least-trustworthy result
a check can produce (nothing had to succeed for it to print). Before accepting any exit 20/21/22/10
that would demote the tier, independently cross-check `gh pr view --json reviews` (formal objects,
with commit.oid) AND `--json comments` / `issues/N/comments` for a `coderabbitai[bot]` summary whose
embedded "between <base> and <head>" range matches the pinned head. Commit-gate EVERY harvested
review body — primary and secondary — against the pinned head, not just the one `harvest.json`
selected.

## CodeRabbit emits its verdict through multiple surfaces

The root of most exit-20 false-skips: CodeRabbit does not always create a formal review object.
It uses at least three distinct GitHub surfaces with different currency:

- **Formal review objects** (`pulls/N/reviews`) — "Actionable comments posted: N", each pinned to
  the commit it was submitted against; these go STALE on a rebase.
- **The walkthrough / recent-review SUMMARY issue-comment**, which CodeRabbit EDITS in place as new
  commits land, stating the interval it just reviewed ("between <base> and <head>"). This can be
  head-current even when every formal review object is stale
  ([CodeRabbit's formal review OBJECTS and its recent-review SUMMARY are DIFFERENT collections](../learnings/1786694530901-approver-clause-gap-coderabbit-s-formal-review-obj.md)).
- **A plain "No actionable comments were generated 🎉" issue comment** when it finds nothing — the
  clean verdict lives in `issues/N/comments`, which the collector never reads
  ([CodeRabbit "clean" posts as an issue comment, not a formal review](../learnings/1787896130226-approver-clause-gap-coderabbit-clean-posts-as-an-i.md)).

`harvest-reviews.py`'s staleness check keys on the review OBJECT's `commit_id`, so exit 10 correctly
means "no head-current review OBJECT" but says nothing about the summary comment's currency — the
same collection-scoping trap as "newest non-bot comment is null" (a `null` in one GitHub collection
says nothing about the others). On slang-rhi#797 a harvest exit 10 was written up as "CodeRabbit
stale/ignored" while its recent-review SUMMARY explicitly covered the current-head interval and said
"No actionable comments were generated" — a head-current CLEAN signal that had been discarded
([distinguish stale review objects from a head-current summary](../learnings/1786694530901-approver-clause-gap-coderabbit-s-formal-review-obj.md)).
A code fix for the collector landed here too: harvest the head-matched CodeRabbit issue-comment as a
first-class secondary review, keyed on **`not match`** (no HEAD-matching pull review), not `not cand`
(no candidates at all), so a fresh head-matched CodeRabbit comment outranks a stale pull review
(exit 0, not 10). The reviewed head must come from CodeRabbit's explicit "between <base> and <head>"
range — a bare SHA anywhere in the body must NOT synthesize a trusted commit_id
([collect-reviews.sh dropped a head-current CodeRabbit issue comment → false exit-20; fix keys on `not match`](../learnings/1786829284875-approver-infra-collect-reviews-sh-dropped-a-head-c.md),
[collect-reviews.sh drops head-current CodeRabbit summary posted as an issue comment](../learnings/1787142627004-approver-infra-abstain-collect-reviews-sh-drops-he.md)).

Two related labelling traps live on the secondary review: `mode=live_late` must be set from the
presence of ANY human review object on the head — including the PR AUTHOR's own `COMMENTED`
submissions (empty body, author login == PR author) — and the harvested SECONDARY (CodeRabbit) body
is NOT commit-gated the way the primary is, so grep its "between <A> and <B>" range and confirm <B>
== pinned head before calling it head-current
([mode=live_late is set by author's own COMMENTED reviews; a harvested secondary can be stale even when "found"](../learnings/1787309073520-approver-clause-gap-mode-live-late-is-set-by-autho.md)).

## exit 20 as a RACE or a pagination miss (not a skip)

Exit 20 and "review imminent" are indistinguishable from a single early harvest. Two mechanisms:

- **Timing race.** On slang#12705 (docs-only) the first harvest at 07:27:45Z returned exit 20
  because the check-runs showed no pending Claude run — but the `github-actions[bot]` review landed
  ~2.5 min later at the pinned head. The tell: exit 20 on a normal human-authored feature/test PR is
  suspicious (production reviews those), whereas exit 20 on a fixer/bot branch is expected. Before
  accepting exit-20 Devin-only on a human MEMBER/COLLABORATOR PR, re-poll `--json reviews` for a
  `github-actions[bot]` review whose `submittedAt` postdates the harvest
  ([harvest exit 20 can be a review-post RACE, not a genuine skip](../learnings/1787557972284-approver-infra-abstain-harvest-exit-20-can-be-a-re.md)).
- **Non-paginated check-runs.** `collect-reviews.sh:62` fetches `commits/$COMMIT/check-runs`
  WITHOUT `--paginate`; GitHub returns 30 per page. On slang#12679 (`total_count=51`) the
  in-progress `review` run sat on page 2, so `pending_bot()` saw an incomplete first page and fell
  through to exit 20 instead of the correct exit 22 (WAIT). The `/commits/$COMMIT/status` endpoint
  it also reads carries only CodeRabbit/CLA statuses — the Claude review is a check-RUN, not a
  commit status, so status.json can't rescue it. The manual guard: `gh api --paginate
  ".../check-runs" --jq '...select(.name=="review" or .status!="completed")'`, or read the GraphQL
  `statusCheckRollup` (not page-capped); `total_count` vs first-page length (30) is the tell
  ([collect-reviews.sh check-runs fetch is NOT paginated — false exit-20 on >30 check-runs](../learnings/1787298186077-approver-clause-gap-collect-reviews-sh-check-runs-.md)).

CodeRabbit-clean-via-issue-comment (slangpy#1125: exit 22 then exit 20 once the CodeRabbit commit
status went `success`) is the same shape: on exit 20/22 with CodeRabbit status success, read
`issues/N/comments` for the "No actionable comments were generated" sentinel + a Commits section
naming a `base…head` matching the pinned head, and record it as a real (fallback-tier) signal, not
NO_REVIEW_SIGNAL
([CodeRabbit "clean" posts as an issue comment — exit 20 is not a signal gap](../learnings/1787896130226-approver-clause-gap-coderabbit-clean-posts-as-an-i.md)).

## exit 10 on a fresh push, and exit 21 on high-review PRs

**exit 10 (stale) on a fresh push is a pending-bot suspect too.** The known note "pending at poll
end ≠ absent" keyed on exit 22; exit 10 on a seconds-old push carrying content the stale review
could not have covered is the SAME hazard with no pending flag — `pending_bot: null` means "no
in-flight run detected at this instant," which right before a run starts is expected. On slang#12601
R3 the harvest returned exit 10 (@ prior head) with `pending_bot: null`; a head-current CodeRabbit
review posted ~6 min later rated the exact defect the challenger found 🟠 Major/blocking. Had the
harvest been re-run, that primary would have driven a clean BLOCK instead of an ABSTAIN the
append-only ledger could no longer upgrade
([harvest exit 10 (stale) on a fresh push is a pending-bot SUSPECT — re-harvest before Devin-only](../learnings/1787905192481-approver-challenger-miss-harvest-exit-10-stale-rev.md)).

**exit 21 on >100-review PRs is the OneCLI-proxy pagination 401 defect, not absence.** `rel="next"`
rewrites `repos/OWNER/NAME/...` → `repositories/<id>/...`, which the proxy allow-list rejects — so
it fires exactly on the highest-review-activity PRs, wearing the costume of conservatism. The fleet
has a durable standing order: BEFORE ACCEPTING ANY EXIT 21, hand-page `pulls/N/reviews` via GraphQL
and look for a trusted-bot review at the head. On slang#12446 (243 reviews) hand-paging recovered a
real head-current `github-actions[bot]` COMMENTED review, so `reviewers_complete:true` / OPEN_GAP
was correct, not NO_REVIEW_SIGNAL
([collect-reviews exit 21 recurs as a FALSE NO_REVIEW_SIGNAL](../learnings/1787747137195-approver-infra-abstain-collect-reviews-exit-21-rec.md)).
A sharp secondary lesson from the same case: an independent critique agent (codex) does NOT hold the
fleet's learnings store, so it will argue from the literal procedure text and PUSH you toward the
false-abstain — rebut it with the documented defect + the recovered head-current primary's
commit_id/footer, name it as a procedure-authority question, and escalate rather than silently
override. (This is developed further on the approver-ledger-scoring page.)

## A red `review` check is not always a code verdict

Related classification trap: when the primary review body is ABSENT and the `review` check is RED,
the redness can be an NV-inference gateway INFRA error (`Claude execution failed: result
is_error:true`, gateway env vars blank), NOT a REQUEST_CHANGES and NOT a build/test failure. On
slang#12569 the `PR Review` step failed for infra reasons so `Post PR Review` had nothing to post →
no `github-actions[bot]` body to harvest → correctly the FALLBACK tier (CodeRabbit + Devin), not
NO_REVIEW_SIGNAL. Read the failing step (`gh run view <run> --log-failed`) before attributing a
verdict to a red `review` check; and do not treat it as a blocking CI signal in `ci_green_on_sha`
reasoning — `eval-clauses.py` reads the combined commit status and does not conflate the
review-harness check with the build/test matrix
([a red slang `review` check can be an NV-inference infra error, not a code verdict](../learnings/1786959551599-approver-challenger-calibration-a-red-slang-review.md)).

**Source learnings (10):**

- [CodeRabbit's formal review OBJECTS and its recent-review SUMMARY are DIFFERENT collections with different currency](../learnings/1786694530901-approver-clause-gap-coderabbit-s-formal-review-obj.md) — slang-rhi#797; harvest exit 10 keyed on the review objects and missed a head-current clean summary comment.
- [collect-reviews.sh dropped a head-current CodeRabbit review posted as an ISSUE COMMENT → false exit-20; fix keys on `not match`](../learnings/1786829284875-approver-infra-collect-reviews-sh-dropped-a-head-c.md) — slang; resolve the head-matching pull review FIRST; require CodeRabbit's explicit base…head range, never a bare SHA; comments-fetch failure ⇒ exit 21.
- [collect-reviews.sh drops head-current CodeRabbit summary posted as an issue comment (exit 20)](../learnings/1787142627004-approver-infra-abstain-collect-reviews-sh-drops-he.md) — slang#12618; the no-review-object branch exits 20 before persisting the CodeRabbit issue-comment summary; cross-check `--json comments`.
- [collect-reviews.sh check-runs fetch is NOT paginated — false exit-20 skip on PRs with >30 check-runs](../learnings/1787298186077-approver-clause-gap-collect-reviews-sh-check-runs-.md) — slang#12679; an in-progress `review` run on page 2 of 51 check-runs was invisible; correct code was exit 22; use `gh api --paginate` / statusCheckRollup.
- [mode=live_late is set by author's own COMMENTED review objects; a harvested secondary review can be stale even when "found"](../learnings/1787309073520-approver-clause-gap-mode-live-late-is-set-by-autho.md) — slang#12649 rev 2; set mode from any human review object on the head; commit-gate the secondary CodeRabbit body's base…head against the pinned head.
- [harvest exit 20 can be a review-post RACE, not a genuine skip — re-check reviews before Devin-only](../learnings/1787557972284-approver-infra-abstain-harvest-exit-20-can-be-a-re.md) — slang#12705; the production review landed ~2.5 min after harvest; exit 20 on a human-authored PR is suspicious, on a fixer/bot branch expected.
- [collect-reviews exit 21 recurs as a FALSE NO_REVIEW_SIGNAL — hand-page GraphQL first](../learnings/1787747137195-approver-infra-abstain-collect-reviews-exit-21-rec.md) — slang#12446 (243 reviews); the OneCLI-proxy `--paginate` 401 defect fires on the highest-activity PRs; a critique agent lacking the fleet correction will argue for the false-abstain.
- [CodeRabbit "clean" posts as an issue comment, not a formal review — harvest exit 20 is not a signal gap](../learnings/1787896130226-approver-clause-gap-coderabbit-clean-posts-as-an-i.md) — slangpy#1125; on exit 20/22 with CodeRabbit status success, read `issues/N/comments` for the clean sentinel + base…head match.
- [Harvest exit 10 (stale review) on a fresh push is a pending-bot SUSPECT even when pending_bot is null — re-harvest](../learnings/1787905192481-approver-challenger-miss-harvest-exit-10-stale-rev.md) — slang#12601 R3; a head-current CodeRabbit review posted ~6 min after harvest rated the defect 🟠 Major; append-only ledger could not upgrade the earlier ABSTAIN.
- [A red slang `review` check can be an NV-inference infra error, not a code verdict](../learnings/1786959551599-approver-challenger-calibration-a-red-slang-review.md) — slang#12569; `is_error:true` gateway failure left no bot body → fallback tier; read the failing step and don't conflate it with `ci_green_on_sha`.
