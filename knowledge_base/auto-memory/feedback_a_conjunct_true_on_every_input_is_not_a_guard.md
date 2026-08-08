---
name: feedback_a_conjunct_true_on_every_input_is_not_a_guard
description: "A predicate term true on 100% of the corpus is not a conjunction — it is the other term wearing a conjunction's shape. Measured on nanoclaw#1145: `heading` matched 125/125 real captures, all tab-bar chrome; forcing it `true` still passed 9/9. Audit question: HAS THIS TERM EVER BEEN FALSE?"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 493c853b-ed3f-48c2-b2bb-01a0c8d83ba0
---

# A conjunct that is true on every input is not a guard

Measured 2026-08-07 on `slang-coworkers/nanoclaw#1145` (`devin-fetch.sh`). The
done-guard reads:

```js
const done = heading && summary;   // heading = /Devin.s AI analysis/i.test(t)
```

Replayed against **125 real archived `devin-page.txt` captures**: `heading`
matched **125/125**, and in **125/125** it sat in the **tab-bar** position
(`Commits\n1\nDevin's AI analysis`) — a static section label the page renders
regardless of whether a verdict exists. **Mutation test: force `heading = true`
and the 9-case suite still passes 9/9.**

⇒ `done = heading && summary` **collapses to `summary`**. It reads as a
two-factor check and measures as one.

## The audit question

⭐⭐⭐ **"Has this term ever been false?"** — ask it of every conjunct in a guard
you are about to trust or tighten. A term that is true on the whole corpus
contributes nothing but false reassurance, and it makes the *other* term's
weakness invisible: I nearly credited the guard with strength it never had,
because the conjunction's shape implied a second gate.

This is the same failure mode as a green revert-drill on a test run that skips
every input, and the same bucket as
[[feedback_a_green_checker_that_excludes_the_changed_file]] — there the checker
excluded the changed *file*; here the vacuous term is *inside* the predicate, so
no scope inspection reveals it. **Only mutation does.**

## Cheapest detector

⭐⭐ **Mutate the term to a constant and re-run the suite.** If nothing goes red,
the term is decoration:

```
sed 's#const heading = /Devin.s AI analysis/i.test(t);#const heading = true;#' script.sh > /tmp/mut.sh
node test.mjs   # still 9/9 ⇒ vacuous
```

Corpus frequency is the other half: a term matching **N/N** inputs is a strong
prior for vacuity *before* you mutate. Both are cheap; neither requires
understanding the term's intent.

## Why it survived so long

The regex looks semantic — `Devin's AI analysis` reads like "the analysis
rendered". It is chrome. ⭐⭐ **A term whose STRING sounds like evidence earns
more trust than its measurement supports**; the name is not the measurement.

⚠️ **Scope:** the 125 captures come from the sibling 360-line
`slang-pr-review-runner` copy, and **timed-out runs never write a page**, so the
corpus cannot speak to the timeout population — precisely where a page lacking
the label would land. "`heading` is vacuous" survives this (a label on 125/125
scraped pages plus a self-reporting empty case suffices); **"no page lacks the
heading" does not generalize** beyond the scraped population. See
[[feedback_published_negative_env_claims_need_rederivation]].

## Related, measured on the same chain

The fix that *did* land tightened the poll predicate (`Checks n/m` must be
settled) — real, and armed (pre-patch **2/9 fail** → **9/9**; **2** flips on 125
real captures, **0** toward false timeouts). But the empty-Flags false clean
**survives**, because no gate before `exit 0` requires a verdict token: **27 of
73** admitted pages exit 0 with none, and the 200-byte floor cannot catch them —
the PR description is echoed back, padding the body to ~5 KB.

⇒ ⭐⭐⭐ **Prefer the gate closest to the decision when the causal story is
contested.** Two prior mechanism write-ups on this defect were each wrong while
the gate-level fix was right; a fix at the last gate survives a wrong mechanism,
a fix at an entry condition does not.
