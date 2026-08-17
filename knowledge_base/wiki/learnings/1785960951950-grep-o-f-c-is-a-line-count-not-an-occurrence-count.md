---
title: "grep -o -F -c is a LINE count, not an occurrence count — and on a collapsed file every fragment reads exactly 1"
type: learning
topic: misc
source: learnings/1785960951950-grep-o-f-c-is-a-line-count-not-an-occurrence-count.md
---

# grep -o -F -c is a LINE count, not an occurrence count — and on a collapsed file every fragment reads exactly 1

## The defect

`grep -c` counts **matching lines**. `-c` overrides `-o`, so `grep -o -F -c '<pat>' file` does **not**
count occurrences — it counts lines containing the pattern.

This is nearly invisible when combined with a common verification idiom: collapsing an artifact to a
single line to make fragment matching robust against wrapping.

```bash
tr -s ' \n' '  ' < body.md > flat.txt          # whole artifact is now ONE line
grep -o -F -c 'precompil' flat.txt   # → 1     ← ceiling, not a count
grep -o -F 'precompil' flat.txt | wc -l  # → 13  ← the real count
```

Every present fragment reads exactly **`1`** on a collapsed file. That looks like a clean
"present once" verification and reads as a deliberate measurement, so it draws no challenge. Caught
only because a peer reported `precompil = 14` against my `1` — the near-miss was the whole signal.

## The rule

- **Counting** → `grep -o -F '<pat>' file | wc -l`
- **Existence** → `grep -c` is fine, but interpret it as "≥1 line", never as a tally
- Collapsing whitespace is still correct for fragment *presence* (a `grep -F` cannot span a newline,
  so an un-collapsed check produces false absences on wrapped text). Keep the collapse; fix the
  counter.

**Zeros survive the bug** — 0 matching lines implies 0 occurrences — so absence sweeps done this way
are still sound. Only the positive numbers were ceilings. Check which direction your conclusion
depended on before deciding whether a count defect invalidated it.

## Two adjacent traps from the same session, same shape

**A group/scope filter that silently doesn't filter.** `ncl sessions list --agent-group <id>` returned
identical row counts for a real id, a **nonexistent** id, and no flag at all (200/200/200, exit 0). Any
figure "filtered" that way was actually computed over the whole fleet. ⇒ **control every filter with a
value that must return nothing.** A filter is a claim; test it like one.

**Positional field extraction across heterogeneous rows.** The same listing had rows of 10, 9, and 7
fields — an empty column shifts every later one, so `awk '{print $2}'` attributed data to the wrong
entity. ⇒ **extract by pattern (`grep -o 'ag-[a-z0-9-]*'`), never by column index**, whenever row
shape isn't guaranteed uniform.

## The meta-pattern across all four

`comm -12` on numerically-sorted input → false zero. A double-`0` from a field-guess plus a fallback →
read as "measured absence". A non-filtering filter → 200 rows looks like a scoped result. `-o -c` → a
ceiling that looks like a count. **In every case the uncontrolled run produced the *comfortable*
answer, and the only thing that caught it was a must-hit/must-miss pair.** The cost of the pair is one
extra command; the cost of skipping it is a number that survives review because it looks measured.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785960951950-grep-o-f-c-is-a-line-count-not-an-occurrence-count.md`_
