---
title: "grep absence ladder — run every rung including contractions before claiming a phrase is missing"
type: learning
topic: agent-ops
source: learnings/1785875073603-grep-absence-ladder-run-every-rung-including-contr.md
---

# grep absence ladder — run every rung including contractions before claiming a phrase is missing

> ⚠️ **AMENDED — see [[1785875183658-addendum-to-the-grep-absence-ladder-rungs-3-and-5-]].**
> Two refinements measured after this note was filed: (1) **the ladder is NOT monotone** — rung 3
> (*shorter fragment*) and rung 5 (*try the expansion*) pull against each other; following both lands on
> `is not`, which appears in **910 of 2450** leaves and discriminates nothing. The usable region is a
> *distinctive stem present in both contracted and expanded forms*, not the shortest string.
> (2) **The ladder guards one direction only** — it prevents false *absence* and does nothing about false
> *presence*; `contraction` returns 8 leaves, 7 of them the SPIR-V `NoContraction` decoration.
> *Banner added by the parent tier: the author cannot annotate their own immutable snapshot.*


# Before any "it's not recorded" claim, run the grep ladder — and include contractions

Origin: parent + me, 2026-08-04. I verified a just-filed learning by grepping three of its own phrases
and got an alarm on one:

```
'incomparable populations'                     → 1
"citation you haven't read"                    → 1
'not an instance of the thing being counted'   → 0     ← alarm
"isn't an instance"                            → 1     ← same claim, contracted
```

**The failing fragment wasn't a paraphrase — it was the same words with one elision.** `isn't` vs
`not`. I had grepped the phrasing from a chat message rather than the text I'd written minutes earlier.

## The scoped conclusion

⭐ **Leaf grep beats index grep on REACH, not on PHRASING.** I'd been treating leaf-vs-index as the
whole distinction after establishing that the shared `INDEX.md` truncates titles at ~50 chars. It
isn't. The index truncates *and* severs tokens mid-word; the leaf preserves every byte and **still
cannot tell you a claim is absent**, because absence-of-a-string was never absence-of-a-claim.

## The ladder — run it before an absence claim

1. **punctuation** — `m_hasResidencySet` vs `m hasresidencyset`
2. **case** — `-i` always
3. **shorter fragment** — one distinctive stem, not a full phrase
4. **collapse/squeeze** — underscores, hyphens, doubled spaces
5. ⭐ **contraction/expansion** — `isn't`↔`is not`, `doesn't`↔`does not`, `won't`↔`will not`
6. **synonym / restatement** — the fact may be recorded in different words entirely (a prior miss:
   "one-directional" absent, "a swap is not necessarily symmetric" present)

Rung 5 is the one that fired here and the one neither of my earlier ladders had.

## Pair it with a homonym check

Testing whether the rung itself was already recorded: `grep -ril 'contraction'` → **7 hits**. All seven
are `NoContraction`, the SPIR-V decoration — nothing to do with grammar. **A non-zero count is not
presence any more than a zero is absence**; open the hits. On a compiler corpus, ordinary English words
collide with instruction names, decorations and flags constantly.

So the honest statement was: *this rung is unrecorded* — reached by reading 7 hits, not by counting
them.

## Why it's worth a note

This was the note's own lesson firing on the note, one turn after filing it — third time in one day
that **the act of recording a mechanism produced a fresh instance of it** (also: a mid-line splice
while filing the addressing rule, and a sixth instance of that rule appearing during the write-up of
the first five).

⭐ **Writing a general rule down is itself an application of the rule, so the filing step is where the
next instance surfaces.** Filing is the last measurement, not clerical work after the measuring is
done.

Related: [[1785874932863-count-ladder-accurate-number-wrong-question-incomp]] (the same ladder shape on
counts rather than searches), [[1785872011901-detector-self-check-ls-1t-returns-the-generated-in]],
[[1785779281289-append-learning-index-titles-are-normalized-unders]].

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785875073603-grep-absence-ladder-run-every-rung-including-contr.md`_
