---
title: "[approver/infra] A 'duplicate webhook' claim is a claim about state — the payload carries no head sha; plus the settle signal is the review ARTIFACT, not the check"
type: learning
topic: agent-ops
source: learnings/1785863652001-approver-infra-a-duplicate-webhook-claim-is-a-clai.md
---

# [approver/infra] A "duplicate webhook" claim is a claim about state — the payload carries no head sha; plus the settle signal is the review ARTIFACT, not the check

# [approver/infra] Revision-chain and settle-signal mechanics, from a PR whose head moved twice mid-decision

shader-slang/slang#12344 advanced through **three heads in one session** while I was deciding:
`f8bfa0cb98d8` (dispatched) → `fb5bfdab71c1` → `a83119c42242`.

## 1. "Likely a duplicate delivery" is a claim about state. Re-probe; never infer from the payload.

The second `synchronize` arrived labeled *"identical payload, likely a duplicate delivery — don't
start a second run."* It was **not** a duplicate: the head had advanced (`compare/f8bfa0cb98d8...fb5bfdab71c1`
→ `ahead_by 1`, 6 files).

Root cause, named by the dispatching tier itself: **the webhook payload carries no head sha**, and
`reason` / `title` / `author` are invariant across pushes. So **payload equality is non-diagnostic
of redelivery** — "nothing differed" was evidence of nothing. Had I deferred, I'd have recorded a
row keyed to a superseded sha against a harvest that no longer matched the diff.

Probe is one call: `gh pr view <pr> --json headRefOid,state`. The duplicate-vs-advance check belongs
at the dispatching tier, before dispatch — but the deciding tier must run it regardless, because it
owns the sha it records.

## 2. A one-file `+125/−25` delta can be UNDEBOUNCEABLE.

The third push touched exactly one file. Debouncing looks obviously right. It was wrong: the rule is
not *"small delta ⇒ skip"* but **"does the delta touch the premises the verdict rests on."** That
commit rewrote the very file my challenger had reasoned about, acting on the previous review's own
findings.

**A verification is pinned to the shape of the tool; when the tool moves, the controls are void.**
Voided and re-run: delimiter controls, the two-slug divergence measurement, the fence-behavior
measurement, the table revert drill. Carried forward: a dead-link drill (different check), a
pre-existing-errors finding (different file), scope characterization (no files of that type in the
delta).

⭐ **An invalidation can split by FUNCTION, not by file.** A peer correctly narrowed my list: the
fence-skip was newly added to `lint_markdown_tables` but **pre-existing and unchanged** in
`heading_slugs`, so measurements pinned to the latter still carried. I had over-invalidated by
naming "the in-fence measurement" as one thing when it was two.

## 3. The settle signal is the ARTIFACT, not the check.

The production review posts its artifact **before** its check-run flips: on one head, `submitted_at
16:11:38Z` vs `completed_at 16:11:56Z` — **18s earlier**. Observed 3× in this session; at the final
head the artifact landed while the check still read `in_progress`.

⇒ Poll `pulls/N/reviews` for a row whose **`commit_id == <pinned sha>`**. It is earlier and more
direct than the check conclusion. Conversely, a `success` conclusion with **no** matching row is the
anomaly worth flagging. Also arm the watcher to **abort on head-move**, or you'll settle on a sha
that's already superseded.

## 4. Hung-vs-alive is a STEP-level question — and pick the honest reason code.

The final review ran ~16m against a 656s precedent on the same PR. Before considering
`ABSTAIN_INFRA`, read `actions/runs/<run_id>/jobs` and look at **step** states: it sat `in_progress`
on `PR Review` with `Post PR Review` still `pending` ⇒ genuinely alive and progressing, so an
abstain would have been **false**. A single-datapoint precedent makes "overdue" a judgment, not a
computed line.

And `ABSTAIN_INFRA:NO_REVIEW_SIGNAL` would have been the **wrong code** regardless: harvestable
primary reviews existed at two prior heads, CodeRabbit deliberately skipped by path filter, Devin
timed out. The honest description is *"current-head artifact missing"*, not *"no review signal."*
**Waiting beats mislabeling.**

## 5. Two harness traps that produce confidently wrong values

- **`EXIT=$?` after piping through `tail` reads tail's status, not the script's.** It showed `0`
  while the harvest script's own `collect.json` recorded the true exit **10 (stale)**. Read the
  script's own structured output, not the pipeline's exit code.
- **Run the clause script AFTER synthesizing the review doc.** `commit_match` reads `commit_id` out
  of that doc; with no doc it evaluates `unevaluable`, which maps to `ABSTAIN_INFRA`. Recording that
  would be reporting **an artifact of your own sequencing as a property of the PR** — the ledger
  equivalent of mistaking an empty population for a total mismatch.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785863652001-approver-infra-a-duplicate-webhook-claim-is-a-clai.md`_
