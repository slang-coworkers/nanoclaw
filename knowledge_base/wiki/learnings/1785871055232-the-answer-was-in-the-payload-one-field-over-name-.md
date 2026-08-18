---
title: "The answer was in the payload, one field over — name the field before quoting the value"
type: learning
topic: misc
source: learnings/1785871055232-the-answer-was-in-the-payload-one-field-over-name-.md
---

# The answer was in the payload, one field over — name the field before quoting the value

# A class of error where care is not the remedy, because the correct field was already in hand

Distinct from the instrument-mismatch class (a tool answering a slightly different question than the one
asked, caught by comparisons that generate their own baseline). This class has a different signature and a
different fix.

**Signature: the correct field existed in the same response you were already holding, and you quoted a
neighbouring one.**

Five instances from a single day, across two agents:

| what was read | what it actually means | the field that answered the question |
| --- | --- | --- |
| a review row's `submitted_at` | when the review was **written** | the `review_dismissed` event's `created_at` |
| a review's `state` at current head | its **current** value, tense-free | `commit_id` — which commit it judged |
| `compare/HEAD...master` → `behind_by` | describes **master**, the second arg | `git rev-list origin/master ^HEAD --count` |
| `check-runs` filtered on conclusion | **every historical attempt** | latest run **per check name** |
| `100% of tests passed (264/264)` | percentage over **survivors** | the denominator, vs a known-good baseline |

Plus two where the governing field was in a *policy* rather than a payload: a forbidden commit trailer
(lives in commit metadata — absent from diff, PR body and test output), and sender identity in a
multi-session group (`from=` is the group; `thread=` is the speaker).

## Why "read more carefully" fails

The failure is not insufficient care. It is **never having asked which field answers the question.** A
confident reading of the wrong field feels identical from the inside to a correct one — there is no
friction to notice, because the value returned is well-formed and often plausible.

⇒ **Remedy for reads: name the field before quoting the value.** Say "the dismissal time is the
`review_dismissed` event's `created_at`" *before* pasting a timestamp. If you cannot name which field
answers the question, you do not yet have the answer — you have a nearby number.

⇒ **Remedy for policy rules: a check at the boundary where the rule becomes violable.** A prohibition on
commit-message content needs a pre-push `git log --format=%B <range> | grep -i <forbidden>`; a
session-identity rule needs keying on `thread=`. Reading the rule again never helps, because the rule was
already known and retrievable — it was the *inspection* that never happened.

## Companion note on the other class

For instrument mismatch, the dominant defence is a **comparison that generates its own baseline** — a
two-sided drill, an orientation control against a known relationship, a non-zero control on an emptiable
query, a positive control proving a predicate can fire. It never requires knowing the correct value, only
that two readings differ, which is why no reference error survives it.

**Its failure mode is simply not running it** — and that, too, is what a confident reading feels like from
the inside. Both classes therefore share one meta-rule: *the moment a reading feels obviously right is the
moment no check is scheduled.*

## Bonus: identity discriminators when everything is one actor

Where many sessions of one agent share a bot identity, neither the chat sender name nor **git commit
authorship** separates them — every push is authored by the same bot. The only discriminators are
**branch** and **thread**, and they agree. So an attribution question is answered by "which branch / which
thread," never by "who authored it."

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785871055232-the-answer-was-in-the-payload-one-field-over-name-.md`_
