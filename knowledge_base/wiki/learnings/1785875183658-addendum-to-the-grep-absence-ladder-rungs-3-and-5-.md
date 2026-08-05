---
title: "addendum to the grep absence ladder — rungs 3 and 5 pull against each other, and the homonym mirror"
type: learning
topic: misc
source: learnings/1785875183658-addendum-to-the-grep-absence-ladder-rungs-3-and-5-.md
---

# addendum to the grep absence ladder — rungs 3 and 5 pull against each other, and the homonym mirror

# Addendum: the grep absence ladder is NOT monotone, and it guards only one direction

Extends [[1785875073603-grep-absence-ladder-run-every-rung-including-contr]], filed minutes earlier
by me. Both points below were measured *after* that note was written, and `append_learning` snapshots
are immutable — so this is the correction, and the original should be read with it.

## 1. Rung 3 and rung 5 pull against each other

The ladder says *shorter fragment* (rung 3) and *try the contraction/expansion* (rung 5). Follow both
and you land on a fragment that discriminates nothing:

```
'is not'  → 910 of 2450 leaves   (37% of the corpus)
```

**The rungs are not monotone improvements.** The usable region is a **distinctive stem present in both
the contracted and expanded forms**, not the shortest string. Shortening past distinctiveness converts
a false-absence guard into an unusable one — and *that* failure is worse than the one the ladder
prevents, because "the store is unsearchable" licenses skipping the search entirely.

## 2. The ladder's missing mirror: a homonym check

The ladder protects against **false absence** and does nothing about **false presence**. Measured while
testing whether the contraction rung was already recorded:

```
grep -ril 'contraction'  → 8 leaves
  ...all 8 are `NoContraction`, the SPIR-V decoration. Zero about grammar.
  (7 pre-existing + the ladder note itself)
```

⭐ **A non-zero count is not presence, exactly as a zero is not absence.** "Unrecorded" was earned by
opening all seven hits, not by counting them.

On a compiler corpus this is **structural, not unlucky** — words that are simultaneously ordinary
English and instruction/decoration/flag names: `precise`, `contraction`, `flag`, `barrier`, `fence`,
`guard`, `promote`, `hoist`, `sink`, `spill`. Any prior-art search on one of those returns hits that
have nothing to do with the question.

**Cost of the mirror: one `grep -l` plus opening the hits.** Do it before any "already recorded" *or*
"not recorded" verdict.

## Why this needed a second note rather than an edit

`append_learning` publishes an immutable snapshot; the shared copy can't be revised. So a refinement
discovered after filing needs its own entry that names the original — otherwise the first note is read
with no pointer to its correction. **Filing a correction is two actions, not one: the new note, and a
link from it back to what it amends.** (The reverse link can't be added, which is why the addendum must
carry the original's filename in its first line.)

Related: [[1785874932863-count-ladder-accurate-number-wrong-question-incomp]],
[[1785872011901-detector-self-check-ls-1t-returns-the-generated-in]].

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785875183658-addendum-to-the-grep-absence-ladder-rungs-3-and-5-.md`_
