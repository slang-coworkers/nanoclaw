---
title: "gh CLI Usage & PR/Issue Mechanics (part 2)"
type: concept
group: ci-tooling
tags: [gh-cli, github, pr, issues, workflow, bot-process, slang]
source_count: 4
---

# gh CLI Usage & PR/Issue Mechanics (part 2)

> **This page is part 2 of 2** of the gh CLI Usage & PR/Issue Mechanics synthesis (split 2026-08-07 to stay under the 40 KB read cap). Siblings: [part 1](ci-gh-cli-usage.md). The TL;DR below is shared across all parts.

## TL;DR
- **`gh search` is not an existence or merge oracle.** `gh search prs`/`issues` have index lag and return false zeroes; `is:merged` returns 0 while PRs demonstrably merge. Use the timeline, `closingIssuesReferences`, a `--head fix/issue-<n>` list, or a direct `pulls/<n>` read.
- **A PR title containing `Fix #N` does not auto-close anything** — GitHub honors the keyword only in the PR **body** (or a manual Development-panel link). Verify with `gh pr view <pr> --json closingIssuesReferences`, never a body regex (the `owner/repo#N` long form defeats a naive pattern).
- **`gh issue view --comments` can print nothing at exit 0** — a renderer quirk, not an auth failure. Read `gh api .../issues/<n>` and `.../issues/<n>/comments` instead.
- **Never cite an env var, CLI flag, or command name you have not verified** via `--help`/`man`/repo grep. It is a high-frequency hallucination surface and a fabricated knob name is unrecoverable for the reader.
- **Pushing commits to a `fix/issue-*` branch is not a user-facing write** and needs no per-push approval. The gated set is narrow: PR/issue comments, review replies, reactions, `gh pr ready`, merge.
- **A draft-held fix PR does not discharge the issue comment.** `Fixes #N` in a draft body neither auto-closes nor surfaces; post the 5-bullet on the issue when you *decide* to hold.
- **`gh api .../user.login` omits the `[bot]` suffix** — never compare it raw against a review author.
- **An infra-unblock nudge is not a decision override**: being told "you're unblocked" restores capability, not authority to change a verdict.
- **A `gh` name that resolves is not the name you meant.** `--workflow <typo>.yml` binds silently to a *retired* workflow with the words reordered and serves its old runs. Enumerate workflow paths; never type one from memory. Weeks-old rows in a query about *recent* automation are an instrument alarm, not a finding.
- **`gh run rerun` rc=0 is not proof it fired; an unchanged `run_attempt` is not proof it didn't.** Proof is a second rerun returning 403 "already running". Key reruns on `(workflow_id, event, name)`, never name alone.
- **A run concluding `success` may have declined to act** — read the script's decision line in the log, not the conclusion. Priority-yield aging is contention-gated (12h yield-out / 16h lookback); a yielded run can expire unrerun.
- **Bucket a CI red by its terminal outcome, never by a signature string's presence.** When a challenged total reproduces unchanged, verify its members — offsetting errors pass every sum check.

## Control design: what a passing control actually proves (2026-08-08 fold)

A control whose **healthy answer equals its broken answer** proves nothing — it cannot distinguish the
two states it exists to separate ([CORRECTION to noun-failure-at-reuse item 4: dotEXT and dotAccSatEXT are NOT co-declared](../learnings/1786154633700-correction-to-noun-failure-at-reuse-item-4-dotext-.md)). A "bite check" that asserts only on
impossible input certifies nothing about real input ([A noun failure can enter at reuse rather than at measurement](../learnings/1786153847426-a-noun-failure-can-enter-at-reuse-rather-than-at-m.md)). A positive-control token
must be **lifted from the artifact under test**, not invented, or it validates a different object
([Three classes of control failure — and the noun failure no control can catch](../learnings/1786153502683-three-classes-of-control-failure-and-the-noun-fail.md), [CORRECTION: the lifted-control rule was already in my own tool's design notes](../learnings/1786152977510-correction-the-lifted-control-rule-was-already-in-.md)). And a control validates only the **axis it varies**:
a same-file control can test size and be blind to branch visibility by construction
([A positive control token must be lifted from the artifact, never guessed from its genre](../learnings/1786152440261-a-positive-control-token-must-be-lifted-from-the-a.md)).
**Rule: before trusting a zero, name what the control would print if the instrument were broken —
if that is also zero, the control is decorative.**

**Source learnings (7):**
- [CORRECTION to noun-failure-at-reuse item 4: dotEXT and dotAccSatEXT are NOT co-declared](../learnings/1786154633700-correction-to-noun-failure-at-reuse-item-4-dotext-.md)
- [A noun failure can enter at reuse rather than at measurement](../learnings/1786153847426-a-noun-failure-can-enter-at-reuse-rather-than-at-m.md)
- [Three classes of control failure — and the noun failure no control can catch](../learnings/1786153502683-three-classes-of-control-failure-and-the-noun-fail.md)
- [CORRECTION: the lifted-control rule was already in my own tool's design notes](../learnings/1786152977510-correction-the-lifted-control-rule-was-already-in-.md)
- [A positive control token must be lifted from the artifact, never guessed from its genre](../learnings/1786152440261-a-positive-control-token-must-be-lifted-from-the-a.md)
- [A control whose healthy answer equals its broken answer is decoration — my "impossible date must return 0" bite check CERTIFIED the broken instrument](../learnings/1786138510831-a-control-whose-healthy-answer-equals-its-broken-a.md)
- [A bite check asserting only "impossible input → 0" certifies a dead filter — assert the WIDE case returns the baseline, or the control has no discrimi](../learnings/1786138391512-a-bite-check-asserting-only-impossible-input-0-cer.md)
