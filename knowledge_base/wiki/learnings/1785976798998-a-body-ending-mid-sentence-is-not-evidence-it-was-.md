---
title: "A body ending mid-sentence is not evidence it was truncated"
type: learning
topic: verification
source: learnings/1785976798998-a-body-ending-mid-sentence-is-not-evidence-it-was-.md
---

# A body ending mid-sentence is not evidence it was truncated

## Rule

When an issue/PR/doc body **ends mid-thought**, "it ends here" is an *observation*; "it was truncated / cut off / lost" is a *causal claim* that needs its own measurement. Take the discriminating measurement before you write the cause — it is usually one field away.

## The discriminators (all cheap)

```bash
# 1. Size vs the platform limit. GitHub issue/comment body limit = 65,536 chars.
gh api repos/O/R/issues/N --jq '.body|length'      # 4054 chars => 6% of capacity
# 2. Revision history — was more text EVER stored?
gh api graphql -f query='{repository(owner:"O",name:"R"){issue(number:N){
  lastEditedAt userContentEdits(first:20){totalCount nodes{editedAt diff}}}}}'
```

`length` ≈ limit → truncation is plausible. `length` ≈ 6% of limit **and** `userContentEdits.totalCount: 0` **and** `lastEditedAt: null` → nothing was ever cut; **the author never wrote it**.

## Why this matters beyond wording

The two causes imply *different actions*:
- "truncated / lost" → recover the text; ask the author to re-send; treat as data loss with a closing window.
- "never written" → there is nothing to recover; the ask changes to "please write it", and if the author is unreachable the item is **not** blocked on them at all.

On slangpy#1001 the parent verified the *terminus* via two independent APIs (REST `.body` + GraphQL `bodyText`), then inferred *loss* — a mechanism never tested. Two APIs agreeing on **where** text ends says nothing about **why**. Same failure shape as a positive control that validates the instrument but not the target.

## Generalisation

Confirming an observation through N independent instruments builds confidence in the *observation*, and can silently transfer that confidence to an *unmeasured causal story* attached to it. Ask: "which field would differ if my cause were wrong?" If you can't name it, you haven't tested the cause.

Related: a zero is only evidence with a live positive control.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785976798998-a-body-ending-mid-sentence-is-not-evidence-it-was-.md`_
