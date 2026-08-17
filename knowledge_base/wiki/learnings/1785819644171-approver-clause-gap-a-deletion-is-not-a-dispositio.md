---
title: "[approver/clause-gap] A deletion is not a disposition, and a predicate in one endpoint's vocabulary silently excludes the others"
type: learning
topic: review-approval
source: learnings/1785819644171-approver-clause-gap-a-deletion-is-not-a-dispositio.md
---

# [approver/clause-gap] A deletion is not a disposition, and a predicate in one endpoint's vocabulary silently excludes the others

Two related evidence defects caught in one exchange, both about **a check whose vocabulary cannot express the thing it is supposed to detect**.

## 1. A deletion is not a disposition

An approvals queue read `[]` and `get` on each prior request id returned *"approval not found."* The tempting conclusion — "all three were rejected" — is unsupported: **rows delete on approve OR reject OR expiry, and `get` returns the identical `not found` for all three paths.** An absent row proves the queue cleared; it does not prove *how*. The honest statement is "the queue is empty and none of them held undelivered work," and the disposition is marked **unknowable**, not inferred from the notification that happened to arrive.

Same shape as `mergeable_state`: the field names *that* something changed, never *which* cause changed it. Generalizes to any store where the success and failure paths converge on the same observable — a cleared cache, a removed lock file, a closed issue, a vanished queue row. **Before reading absence as evidence, enumerate every path that produces the same absence.** If more than one does, absence identifies the set, not the member.

## 2. A predicate written in one endpoint's vocabulary silently excludes evidence on another

I recorded a resume trigger as *"a non-bot **review** with an actionable **state** lands."* That is a `review`+`state` predicate — and the directive that was the entire reason for holding (a MEMBER's build-system change request) lives only on `issues/N/comments`, carrying **no review object and no state at all**. So my own resume check could never fire on my own stated blocker; it would report "nothing actionable" indefinitely while the directive stood.

Fixed to: **actionable non-bot feedback in ANY of the three endpoints** — `pulls/N/reviews` (review objects) · `pulls/N/comments` (inline findings) · `issues/N/comments` (directives) — with authority taken from `author_association`, not from API shape.

**The general rule: a predicate expressed in one endpoint's vocabulary silently excludes evidence that only exists on another.** This is the same defect class as a harvester tallying severity markers in `reviews[].body` while the findings sit on `pulls/N/comments` — both times the *data model of the query* quietly became the *definition of the thing*, and both times the omission was invisible because the query succeeded. When writing any gate, trigger, or blocker predicate, ask: **which surfaces can carry this signal, and does my predicate's vocabulary reach all of them?** Prefer semantic terms ("actionable feedback from a non-bot") over schema terms ("review with state X"), because schema terms inherit one endpoint's blind spots.

## Bonus: naming an unreachable authoritative field is a complete answer, not a hedge

When an authoritative field exists but is outside your scope (`cli_scope=group` excluded the approvals ledger entirely), **"cannot read; field F is authoritative; the tier that can read it should map it"** is *complete*, not evasive — it is complete precisely because it names F rather than approximating it. The alternative I had reached for previously was deriving an id by **timestamp adjacency**, which systematically excluded the right answer: the true session was created days earlier and merely *fired* near the card's timestamp. **A wrong identifier is worse than no identifier**, because the next reader re-verifies *through* it and lands somewhere else entirely. Correlation is not identification.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785819644171-approver-clause-gap-a-deletion-is-not-a-dispositio.md`_
