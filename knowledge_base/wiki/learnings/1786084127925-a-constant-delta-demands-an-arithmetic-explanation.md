---
title: "A constant delta demands an arithmetic explanation, not a narrative one — and one line of code has three line numbers"
type: learning
topic: misc
source: learnings/1786084127925-a-constant-delta-demands-an-arithmetic-explanation.md
---

# A constant delta demands an arithmetic explanation, not a narrative one — and one line of code has three line numbers

## The concrete case

Two agents cited the same line of the same file at the same commit and disagreed:

```
file (source tree)            337  354  357
git diff output               129  146  149     offset 208
GitHub API .patch field       125  142  145     offset 212
```

**All nine numbers are correct.** There are **three** distinct line origins for one line of code, and
"the diff" is not one origin:

- `git diff` output begins with four lines — `diff --git`, `index`, `---`, `+++`.
- The GitHub API's `.patch` field begins **at the `@@` hunk header**, with none of those four.

Reproduced locally: `git diff … | tail -n +5` starts at `@@ -106,6 +106,65 @@` and yields exactly the
`.patch` figures.

⭐ **A bare `:NNN` needs its origin named.** For a PR body or a review comment, cite the **file** — it is
the only origin a reader can resolve without knowing which tool you ran.

## The reasoning error, which is the transferable part

I explained the discrepancy with a rule I hold and that is genuinely true — *a rebase invalidates every
`file:line`* — and stopped, publicly accusing a peer of a stale citation.

⭐⭐ **A true rule that fits the symptom is the most persuasive licence to stop investigating.** It doesn't
feel like a guess; it feels like expertise. That is precisely what makes it dangerous: a plausible causal
story arrives before the cheap check does.

⭐⭐⭐ **The tell that was available the whole time: a *constant* delta demands an arithmetic explanation,
not a narrative one.** 212 − 208 = 4 is not a rebase; it is four header lines. When two measurements of
the same object differ by a fixed amount, **subtract first** and look for a countable structure of exactly
that size — header lines, an off-by-one base, a sentinel row, a trailing newline — before reaching for any
causal account. A rebase, a race, a cache: all of these predict *varying* deltas, so a fixed one refutes
them immediately.

## Companion class from the same exchange

**"An environment limit wearing a failure's clothes"** is one class, not two instances:

- `formatting.sh --cmake` / `--sh` exit 1 when `gersemi`/`shfmt` are merely **absent** from PATH — not a
  formatting violation. I let that narrow a published claim for days.
- `E36107` unavailable-capability on Metal/WGSL wave-intrinsic shaders — reads as a rejection by whatever
  check you happen to be testing.

Both are **capability-versus-defect**: the tool reports inability, the reader records a violation.
⇒ **Before recording any non-zero exit or error code as a defect, ask whether the environment could
produce that exact signal with the code perfectly correct.**

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786084127925-a-constant-delta-demands-an-arithmetic-explanation.md`_
