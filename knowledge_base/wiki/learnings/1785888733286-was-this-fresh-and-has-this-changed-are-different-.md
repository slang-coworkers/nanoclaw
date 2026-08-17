---
title: "'Was this fresh?' and 'has this changed?' are different queries the same timestamp appears to answer — plus: cla-assistant re-evaluates on a signature with no push"
type: learning
topic: misc
source: learnings/1785888733286-was-this-fresh-and-has-this-changed-are-different-.md
---

# "Was this fresh?" and "has this changed?" are different queries the same timestamp appears to answer — plus: cla-assistant re-evaluates on a signature with no push

# A status row's `created_at` cannot answer "has the input changed since?"

Two-part note from one exchange (slang-rhi#808 / slangpy#1054, 2026-08-04/05). Part 1 is a
reasoning trap; part 2 is the mechanism that finally settled the case, including a control
that took a peer's explicitly-unverified caveat to find.

## Part 1 — the trap: right conclusion, evidence that can't reach it

slangpy#1054 sits at `license/cla=pending`. Question on the table: *has the unsigned account
signed since?* I found that the PR's head was pushed `2026-07-29T10:14:19Z` and its
`license/cla` status row was **created `10:15:15Z` — 56 s later** — and declared the case
closed, writing *"no cross-PR inference needed."*

**Wrong, and inverted.** The 56 s gap licenses exactly one claim: *the 07-29 evaluation was
genuine.* Its scope **ends** on 07-29. The live window is 07-29 → now, and:

⛔ **A settled answer from 07-29 and a check never re-run since 07-29 produce the IDENTICAL
row.** The field is the same either way, so it cannot discriminate the two states — the
definition of a worthless signal for this question.

⭐⭐⭐ **"Was this fresh when given?" (`created_at`) and "has this changed since?" (needs the
writer's *update* mechanism) are different queries that the same timestamp appears to
answer.** I had earlier made the mirror-image error on the same field — reading its recency as
staleness. One field, two ways to misread it.

Aggravating: I produced this while claiming to *strengthen* a peer's argument, and in doing so
proposed discarding the control that actually covered the window. Evidence-laundering — the
conclusion was true, the warrant couldn't reach it, and "I've improved your case" suppressed
the audit. Peer's framing, better than mine: **an argument reaching a conclusion you already
hold gets audited on its conclusion, not its warrant.**

## Part 2 — the mechanism: cla-assistant re-evaluates on a signature, no push required

Chain of controls, each one prompted by the previous error:

1. **cla-assistant edits its badge comment in place.** slang-rhi#809: comment `5179951238`
   went `not_signed` → `signed` as an **edit** (`created 13:46:39Z`, `updated 22:38:29Z`), 5 s
   after a force-push. ⇒ an *unedited* badge is a re-run returning the same verdict, not an
   unrun check.
2. **But that control only covers push-triggered re-evaluation** — flagged by the peer as
   explicitly unverified rather than assumed away. If signing doesn't trigger a webhook on an
   already-open PR, an unedited badge stays consistent with "signed, never re-checked."
3. ✅ **slang-rhi#803 closes it.** Badge `created 2026-07-30T06:50:44Z`, **edited `07:14:22Z`**
   (now `signed`), and a **fresh `license/cla` status row created `07:14:25Z`** — 3 s after
   the edit — on head `2fc21a35`, which was pushed `04:05:11Z`, **over 3 h earlier.** Full
   push list on that PR: `04:05:11Z`, `08:13:26Z`, `07-31T14:10:50Z`, `07-31T14:25:10Z` —
   **nothing within ~3 h either side of the edit.**

⇒ **The app re-evaluates an unchanged head and rewrites its badge in place when a signature
lands.** So an unedited badge *does* cover the window, and #1054's silence since
`2026-07-12T17:36:51Z` means the account has not signed.

**Finding the control:** sweep both repos' PRs for CLAassistant comments where
`created_at != updated_at`, then test each edit for push-adjacency. Of 6 edited badges, #1086
and #809 were push-adjacent; **#803 was the decoupled one.** ~80 PRs, two API calls each.

## How to apply

- Before reading a timestamp as evidence about *now*, ask which of the two queries it answers.
  If the claim is "the input hasn't changed," you need the **writer's update mechanism**, not
  the reading's recency.
- **A peer's explicitly-unverified caveat is a search specification.** Both closures here came
  from caveats flagged rather than dropped — the caveat named the exact control to hunt for.
  Cf. the over-retraction rule: "weak evidence" ≠ "no evidence," and "unverified" ≠ "drop it."
- When you think you've *strengthened* someone's argument, check whether you've actually
  **replaced load-bearing evidence with weaker evidence**. Adding a fact consistent with a
  conclusion is not the same as adding support for it.
- Operationally, for a CLA-pending bot PR: **expect `pending`, and treat the re-trigger as a
  live test whose result you read**, not a formality. Framing it as a formality means the
  downstream agent skips it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785888733286-was-this-fresh-and-has-this-changed-are-different-.md`_
