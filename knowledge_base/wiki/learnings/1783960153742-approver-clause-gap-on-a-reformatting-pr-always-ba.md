---
title: "[approver/clause-gap] On a reformatting PR, always base-diff a flagged 🟡 before treating it as an OPEN_GAP — pre-existing artifacts the PR only re-whitespaces do not block"
type: learning
topic: review-approval
source: learnings/1783960153742-approver-clause-gap-on-a-reformatting-pr-always-ba.md
---

# [approver/clause-gap] On a reformatting PR, always base-diff a flagged 🟡 before treating it as an OPEN_GAP — pre-existing artifacts the PR only re-whitespaces do not block

## Symptom
slang#12082 rev2 (a docs PR that also re-aligned many markdown tables) drew a fresh production-review 🟡: README:252 "Generated outputs (gitignored)" renders as a table header with zero rows. Taken at face value that's a new OPEN_GAP → ABSTAIN_POLICY. But it was PRE-EXISTING in base master; the PR only changed the header's column padding.

## Root cause
Reformatting PRs touch many lines cosmetically. A reviewer (human or bot) flagging a line that appears in the diff can't tell whether the PR *introduced* the defect or merely *reformatted around* a defect that already existed on master. The production review here flagged the line without checking base — the diff shows `-| Path <pad> |` → `+| Path | What it is |`, i.e. the empty table existed before and after.

## How to catch it
For ANY 🟡 gap on a line the PR touches only cosmetically (whitespace, column widths, reflow), fetch the base and check whether the defect pre-exists:
  BASE=$(gh pr view <pr> --repo <repo> --json baseRefOid --jq .baseRefOid)
  gh api "repos/<repo>/contents/<path>?ref=$BASE" --jq .content | base64 -d > base.txt
  # compare the flagged region in base vs head
If the rendered content is identical before/after (only spacing changed), it's pre-existing. Per the slang-pr-approver skill Step 3, 🟡 gaps are judged only when NOT pre-existing; a pre-existing cosmetic artifact the PR merely reformats is non-blocking (advisory to the author at most), NOT an OPEN_GAP for this PR.

## Fix / transferable rule
Pre-existing ≠ introduced. The decision must attribute a gap to THIS PR before it can block THIS PR. On reformatting/whitespace-heavy diffs this base-diff check is mandatory — it's the difference between WOULD_APPROVE and a false ABSTAIN_POLICY. Related positive signal: a well-scoped OPEN_GAP (here: "invariant false for these 3 timers; these 2 timers undocumented") fed back to the author produced a precise, independently-verifiable fix in one revision — narrow, cited findings convert to clean approvals. See [[not-relisted-not-fixed]] for the converse (verify fixes against source, don't trust "not re-listed").

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783960153742-approver-clause-gap-on-a-reformatting-pr-always-ba.md`_
