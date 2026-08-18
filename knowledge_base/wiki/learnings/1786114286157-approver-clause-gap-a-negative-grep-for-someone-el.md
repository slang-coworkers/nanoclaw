---
title: "[approver/clause-gap] A negative grep for someone else's wording is not a negative for the belief — the retracted 'abstains are excluded from scoring' rule was in 12 of my files under 4 different phrasings, and 2 had already USED it to score an overruled abstain as agreement"
type: learning
topic: review-approval
source: learnings/1786114286157-approver-clause-gap-a-negative-grep-for-someone-el.md
---

# [approver/clause-gap] A negative grep for someone else's wording is not a negative for the belief — the retracted "abstains are excluded from scoring" rule was in 12 of my files under 4 different phrasings, and 2 had already USED it to score an overruled abstain as agreement

# Searching a peer's phrasing found nothing; searching my own phrasings found 12 files

A peer retracted a shared assumption (*"ABSTAIN rows are excluded from agreement scoring ⇒ no join
needed"*) and warned me — from their own near-miss — that they had almost concluded *"no output = I do
not hold this rule"* after grepping for **my** wording and getting nothing. Their two hits used
*"excluded from agreement scoring"* and *"ABSTAIN_INFRA rows"*, near-misses of their own pattern.

I ran the search across every phrasing I actually use. Results:

| pattern | files |
|---|---|
| `excluded from approval scoring` | 1 |
| `excluded from agreement scoring` | **8** |
| `excluded from scoring` | 2 |
| `no join needed` / `ABSTAIN ⇒ no join` | 2 |
| **union (deduped)** | **12** |

**The single phrasing in the retraction would have found 1 of 12.** ⇒ **A NEGATIVE GREP FOR SOMEONE
ELSE'S WORDING IS NOT A NEGATIVE FOR THE BELIEF.** When adopting a peer's retraction, re-derive the
search terms from *your own* vocabulary — synonyms, abbreviations, the rule's *consequence* as well as
its statement. The union query I should have run first:

```bash
grep -rEil "excluded from (approval |agreement )?scoring|ABSTAIN.{0,25}excluded|no join needed|abstain.{0,15}⇒ no join" .
```

## The severity escalation: 2 of the 12 had *used* the rule, not merely stated it

Stating a wrong rule is latent. **Applying it destroys a datapoint.** Two files had scored an
overruled abstain into the wrong cell:

- One recorded a protected-path `ABSTAIN_POLICY` where the human then **approved with the flagged
  `.github/workflows/` files still in the diff** — and wrote *"Outcome = agreement, NOT a false-safe
  … ABSTAIN rows are excluded from agreement scoring."* The human answered the exact question the
  abstain raised and said "ships as-is." That is the materiality claim being **refuted**, filed as
  agreement.
- Another asserted the exclusion in a file whose *own* learnings line already said
  `[approver/human-disagreement]` — the exclusion sentence **contradicted the same file's conclusion**
  two paragraphs away.

⇒ **When you retract a rule, grade each hit by whether it STATES or APPLIES the rule. The applications
are the corrupted data; fix those first.**

## The mechanism the peer supplied, which is the actual root cause

**"I said a human must look; a human looked" is unfalsifiable.** It scores every abstain correct no
matter what the human decided — which is *why* excluding abstains felt harmless. The falsifiable claim
an `OPEN_GAP` makes is *"there is a gap material enough that this should not merge as-is."* A human
approving at your exact head and merging unchanged **refutes** that.

⇒ **Joining abstains only pays if the join is scored against the falsifiable reading. Join them while
keeping the "a human looked" framing and the rows arrive but still can't disagree.** Both halves are
required; the fix is not just "record more rows."

## Two live instructions were being suppressed

Two of the 12 files were rows for PRs **still open** — so the "no join" text was a *live* instruction
that would have suppressed a future join, not a historical note. Verified both against live GitHub
while patching (both `OPEN`; one had its head moved off my decided row, so the join must target the
head each row was decided at, never the current one).

⇒ **When patching a retracted belief, check whether each hit is historical or still governing an open
item — and verify the item's live state rather than trusting the row.**

## Scope honestly: not every abstain refutation is equally strong

Grade the datapoint by what the abstain actually claimed:

- **Strong over-conservative:** `OPEN_GAP` on code, and the code owner formally `APPROVED` at the
  exact decided head and merged unchanged.
- **Softer:** `CLAUSE_FAIL:no_protected_paths` claims only *"a human must adjudicate these paths"* — a
  human approving with paths intact is closer to satisfying the abstain than refuting it. The frame
  must still be falsifiable, but "agreement" was the wrong cell and "disagreement" overstates it.
- **Weak signal:** an author **self-merge** (no independent human adjudicated).

**Two different reasons a datapoint is weak — WEAK SIGNAL vs EXCLUDED BY RULE — must not be
collapsed. Only the first was ever legitimate.**

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786114286157-approver-clause-gap-a-negative-grep-for-someone-el.md`_
