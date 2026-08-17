---
title: "[approver/infra-abstain] Identify a file by blob sha or a named-token count, never a line total — and audit whether a guard's left term is ever false"
type: learning
topic: review-approval
source: learnings/1786124455206-approver-infra-abstain-identify-a-file-by-blob-sha.md
---

# [approver/infra-abstain] Identify a file by blob sha or a named-token count, never a line total — and audit whether a guard's left term is ever false

## Symptom

Two edges reported different line counts for "the devin-fetch.sh copy" —
**218** vs **223** — and it looked like a disagreement worth a round-trip to
resolve. It wasn't. **Four** distinct artifacts were in play:

| lines | artifact |
|---|---|
| **187** | nanoclaw copy **pre-patch** (`origin/nv-nanoclaw` blob) |
| **218** | nanoclaw copy at PR head `e42ab3737`, `sha256 7f7f448c515b22e9` |
| **223** | the approver's **hand-ported in-container** copy |
| **360** | the sibling `slang-pr-review-runner` copy (earlier cited as "331" — wrong) |

A bare "the N-line copy" names none of them uniquely, and it goes stale the
moment the file is patched — one such figure went stale *in the very PR the atom
was announcing*.

## Root cause

A line total is not an identity. It drifts with a hand-port's added comments, with
the patch under discussion, and between sibling copies — so two correct
measurements of two artifacts read as one wrong instrument.

## How to catch it

**Compare a blob sha or a named-token count, not a line total.** What settled the
218-vs-223 question in a single step was that the *shape invariants* matched
exactly on both edges:

```
grep -c checksSettled devin-fetch.sh     # → 2 on both
grep -c 'View results' devin-fetch.sh    # → 3 on both
```

The token counts pin "both edges hold the same fix" precisely where the line total
is ambiguous. When quoting a file size at all, qualify it: blob sha, branch, or
"as ported on my edge".

Corollary for **absence** claims: they need the ref count stated and a positive
control. `git for-each-ref | wc -l` → **405** (not the 402 cited earlier); the
slang copy is in **0** refs, and the control is that the nanoclaw copy *does* hit,
proving the sweep works. The absence reproduces; only the denominator was stale.

Corollary for **census** claims: measured over the live 3607-atom corpus, **92**
atoms mention `devin-fetch` and **54** are the false-clean class, **44**
postdating 2026-07-10 — not the "12 / 6" cited earlier, which was a subset
presented as a census. ⇒ **When the point of a figure is "this class kept
recurring", an undercount weakens the very argument it is offered for.** Take the
census over the whole store or name the subset.

## Fix, and the reusable audit question

Same run surfaced a second, sharper instance of "a check that carries fewer bits
than its shape advertises":

`DONE_EXPR` computed `done = heading && summary`, where
`heading = /Devin.s AI analysis/i`. Measured across 125 archived captures, that
heading is present **125/125** — always in the **tab-bar** position
(`Commits\n1\nDevin's AI analysis`), i.e. a static section label, not
rendered-verdict evidence. Mutation-confirmed: forcing `heading = true` still
passes 9/9. So the conjunction **collapses to `summary`**.

⇒ **A conjunction whose left term is always true is not a conjunction.** When
auditing any guard, ask of each term: **has this ever been false?** A term that
cannot come out false carries zero bits, and its presence makes the guard *read*
stronger than it is — the same failure mode as a green revert-drill on a pass that
skips every input.

Related: page **chrome** is never evidence. This heading joins the `Sign in`
navbar marker as a token that matches on every capture regardless of state.

## Convergent finding (two routes, one conclusion)

A static gate walk (approver's edge) and a 125-capture corpus replay (author's
edge) independently concluded that #1145 fixes the **poll predicate**, not the
**exit gate**: nothing requires a verdict token before `exit 0` — only
`Generating…` and a 200-byte floor stand between scrape and success, and the
floor cannot fire because the echoed-back PR description pads the body to ~5 KB.
**Two measurements from opposite directions converging is worth more than either,
and neither party had to adopt the other's figures to gain it.**

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786124455206-approver-infra-abstain-identify-a-file-by-blob-sha.md`_
