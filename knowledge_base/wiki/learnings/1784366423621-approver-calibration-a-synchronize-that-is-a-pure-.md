---
title: "[approver/calibration] A 'synchronize' that is a pure master-merge fixes nothing — verify blob-sha equality before assuming a re-push addressed prior findings"
type: learning
topic: review-approval
source: learnings/1784366423621-approver-calibration-a-synchronize-that-is-a-pure-.md
---

# [approver/calibration] A "synchronize" that is a pure master-merge fixes nothing — verify blob-sha equality before assuming a re-push addressed prior findings

**Symptom:** PR #11471 was BLOCKed at R1 for two 🔴s. It then fired a `synchronize` webhook (new head pushed), and the tasking asked me to "check whether this push addresses" the bugs. The naive read of a `synchronize` is "the author revised — re-review the fix." But the new head `6b66fb1af24e` was a `Merge branch 'master'` commit: the author merged upstream master into their branch, changing **nothing** in the PR's own content.

**Root cause:** `synchronize` fires on ANY head change, including master-merges and rebases that don't touch the PR's diff. The last *non-merge* PR commit was still `92cc67d187aa` (from 11 days earlier). Treating every `synchronize` as "the fix is in" wastes a full cycle and — worse — risks a reviewer/approver assuming issues were addressed when they weren't.

**How to catch it (cheap, decisive):** Before re-reviewing, compare the flagged files across the two heads by **git blob sha**: `gh api repos/<repo>/contents/<path>?ref=<sha> --jq .sha` for each head. Identical blob sha ⇒ the file is byte-identical ⇒ any prior finding in it persists verbatim. Also compare the PR diff totals vs merge base (`gh pr view --json additions,deletions,changedFiles`) — if unchanged, the effective PR content is unchanged; only the baseline moved. For #11471 both flagged files matched (`55bd78ae9488`, `5f3c40b99799`) and the diff totals were identical (1471/36/15), so the two 🔴s were trivially still present — I re-verified the exact lines at the new head and re-BLOCKed.

**Fix:** On a `synchronize` re-decision, first classify the delta: (a) master-merge/rebase with flagged files blob-identical → prior findings persist, re-BLOCK/re-hold without re-litigating (still run the full procedure for the ledger row, but the verdict is settled by the blob-sha check); (b) flagged files actually changed → do the real fresh review of the change. Never assume a re-push is a fix. Companion to the revision-chain rule (one ledger row per revision commit; R1 doesn't carry forward as evidence, but blob-sha equality is a fact you may cite).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784366423621-approver-calibration-a-synchronize-that-is-a-pure-.md`_
