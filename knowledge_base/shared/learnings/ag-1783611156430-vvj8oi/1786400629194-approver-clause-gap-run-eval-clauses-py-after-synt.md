---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784180176857-773lfi
written_at: 2026-08-10T22:23:49.194Z
---

# [approver/clause-gap] Run eval-clauses.py AFTER synthesizing review-doc.md — my ordering error manufactured a commit_match=unevaluable that would have been a spurious ABSTAIN_INFRA

## Symptom

On shader-slang/slang#12136 @`25d3e44ed532` my first `eval-clauses.py` run reported:

```
pass=['author_trust','head_provenance','ci_green_on_sha','no_protected_paths','tier_eligible']
UNEVALUABLE=['commit_match']  -> ABSTAIN_INFRA
```

`CLAUSE_UNEVALUABLE:commit_match` maps to **ABSTAIN_INFRA** — a named pipeline defect, on a gate
whose rate is supposed to be driven to ~0. Re-run later with no other change: **all 6 PASS.**

## Root cause

I ran the clause script **before** writing `review/review-doc.md`. `commit_match` compares the
review doc's embedded `_approver_result.commit_id` against the pinned `commit_sha`
(`eval-clauses.py` `_result_block()` parses `review/review-doc.md`). With no doc on disk there is
nothing to compare, so the clause correctly reports `unevaluable`.

**The script was right. My sequencing was wrong.** Nothing was broken; I had simply asked a
question about an artifact I had not created yet.

## How to catch it

- **The workflow's step order is a data dependency, not a suggestion:** stage → harvest + Devin →
  **synthesize `review-doc.md`** → *then* Step 1 clauses → Step 2 verdict → Step 3 challenger.
  Two clauses (`commit_match`, and the `diff_hash` it reports) read the synthesized doc.
- **Before recording any `ABSTAIN_INFRA`, ask whether the named artifact was absent because the
  pipeline failed or because I had not produced it yet.** Those are opposite diagnoses with
  opposite remedies — escalate a harness defect vs. re-run in the right order.
- ⭐ The general form: **an `unevaluable` verdict is a claim about the INPUTS I supplied as much as
  about the system.** An infra-abstain asserts "data that should have been staged is absent" — if
  I am the one who was supposed to stage it, that assertion is about me. Same family as *my own
  artifact needs enumeration, not recall*.
- Cheap tell: an `ABSTAIN_INFRA` naming an artifact **I write myself** (as opposed to one GitHub,
  CI, or a review bot produces) should be assumed self-inflicted until re-run in order.

## Fix

Synthesize `review-doc.md` first, then run `eval-clauses.py`. If a clause reads `unevaluable`,
`ls` the artifact it names before believing the pipeline failed. Record the sequencing note in the
`clauses` payload so an auditor cannot misread the final abstain as having had an infra component.
