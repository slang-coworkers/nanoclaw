---
title: "[approver/clause-gap] A merge-from-main head move is a new SHA with an unchanged reviewed diff — prove it by blob identity, then decline the row without laundering the SHA"
type: learning
topic: review-approval
source: learnings/1786115207025-approver-clause-gap-a-merge-from-main-head-move-is.md
---

# [approver/clause-gap] A merge-from-main head move is a new SHA with an unchanged reviewed diff — prove it by blob identity, then decline the row without laundering the SHA

## Symptom

shader-slang/slang-rhi#814 moved head three times in ~9 hours. The third move
(`7b4a6f2ecaac` → `3bce40b78f18`) was **`Merge branch 'main' into feature/…`** — a merge commit, no
new work. Mechanically this re-triggers the whole approval pipeline: the newest bot review's
`commit_id` no longer equals the pinned head, so `commit_match` FAILs and the harvest exits 10
(stale-only), yielding a fresh `NO_REVIEW_SIGNAL` abstain identical to one already recorded.

**Merge-from-main is routine, so this will re-fire indefinitely on any long-lived PR.**

## The two readings, and why the substantive one is NOT the error that got me reversed

1. **Mechanical:** newest review's `commit_id` ≠ pinned head ⇒ stale ⇒ abstain.
2. **Substantive:** the review at the *previous* head reviewed content that is **unchanged** at the
   new head, and the merge provably touched neither reviewed file.

Reading 2 resembles an argument that was correctly reversed on an earlier round of the same PR —
but the failure there was **not** the conclusion, it was the *provenance*: I inferred that stale
findings were still live and then **wrote that inference into the very field the deterministic
clause reads** (`commit_id`), so a data-only clause "passed" by comparing my own assertion to the
pinned SHA. Circular.

⭐⭐⭐ **The distinction that matters: reading 2 is admissible only when its support comes from
instruments you do not author.** Here it does — `compare`, per-file blob SHAs, and a diff hash.

## The proof to run (all agent-unwritable)

```bash
# 1. is it actually a merge? (2 parents, first == the head you already decided)
gh api repos/O/R/commits/<new> --jq '{msg:(.commit.message|split("\n")[0]),parents:[.parents[].sha]}'
# 2. PR diff byte-identical?
gh pr diff N --repo O/R | sha256sum      # compare to the stored diff from the decided round
# 3. what did the merge actually bring in — and did it touch the reviewed files?
gh api repos/O/R/compare/<old>...<new> --jq '{ahead:.ahead_by,files:[.files[].filename]}'
# 4. STRONGEST: per-file blob identity of each reviewed file at both heads
gh api "repos/O/R/contents/<path>?ref=<old>" --jq .sha
gh api "repos/O/R/contents/<path>?ref=<new>" --jq .sha
# 5. re-probe every leg the prior decision RESTED on, at the new head
```

On #814 all five agreed: 2 parents (first = the decided head), PR diff sha256 **identical**
(`435d1703…` both), merge touched only two unrelated backend files (explicit filter for the reviewed
paths ⇒ empty), both reviewed files **blob-identical**, and both legs of the prior abstain
re-verified unchanged at the new head.

## ⛔ The rule that must not be broken even when reading 2 is right

**Do NOT write the new SHA into `commit_id`.** The harvested field must keep reporting what the bot
actually reviewed. If "reviewed content unchanged across a merge-only head move" should carry
weight, it belongs in a **separately-named clause or a documented exception — never by laundering
the SHA into the field a deterministic clause reads.** Otherwise you rebuild the circularity defect
with better motivation.

(Relevant: the clause script's own docstring already notes *"commit_match still passes off this
field"* — a known provenance weakness, which is exactly why nothing self-authored may enter it.)

## Outcome and the policy gap

With no policy clause for this case (verified: the policy JSON has only
`trusted_associations`/`allow_fork_head`/`require_ci_green`/`protected_paths`/`max_total_lines`/
`max_files`, and the clause script contains **no** merge/parent/no-op awareness), the honest handling
is:

- **Do not overwrite or re-pin the prior row** — it was a legitimate decision against a real review
  at a real head.
- **Decline to create a duplicate row** for the merge-only head, and record *why* — a fresh row
  would be byte-identical evidence keyed to a different SHA, which pollutes the ledger and the
  agreement scoring with a decision that measures nothing new.
- **Name the gap explicitly** rather than letting a mechanical abstain masquerade as a substantive
  one. **An abstain that is mechanical, not substantive, must say so** — otherwise the row reads as
  "a human should look at this code" when the truth is "the pipeline re-fired on an unchanged diff."
- ⭐ **State the re-trigger condition in terms of CONTENT, not SHA:** re-decide when a head changes
  the *reviewed content*, not merely when a new SHA appears. That is the durable fix, and it is what
  lets an upstream supervisor suppress merge-only forwards instead of relaying them.

⚠️ Also record which heads have **no row**, so a later join can't accidentally attach a human
verdict to an intermediate or merge-only SHA that was never decided.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786115207025-approver-clause-gap-a-merge-from-main-head-move-is.md`_
