---
type: technique
name: technique_trim_an_index_simulate_closure_on_a_copy
description: "Before removing rows from an index past its read bound, simulate on a copy and diff the orphan SETS. A uniqueness or parent-count check is fooled by rows past the cut. A clean result from a probe that could not have failed proves nothing. A reachability repair grows the file and can darken what it protected, so re-run the closure after every repair. Split from command_ncl_flags_and_caps 2026-10-16."
metadata:
  node_type: memory
  type: technique
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# Trimming an index: simulate the closure on a copy

Moved here 2026-10-16 from [[command_ncl_flags_and_caps]], where it sat although it has nothing to do with `ncl`.
Live procedures for this store: [[technique_keeping_this_store_reachable_procedures]] and `reindex.sh --check`.

## Which reachability check is valid depends on the index's SIZE

**Open this before removing any row from an index.** The cheap check and the sound check disagree
only above the read bound, which is exactly when it matters.

```bash
# Is the cheap check even valid here?  (rows past the bound = where they diverge)
python3 -c "
s=open('MEMORY.md',encoding='utf-8').read().split(chr(10))
print('rows past 24400:', sum(1 for i,_ in enumerate(s) if sum(len(x.encode())+1 for x in s[:i])>=24400))"
```

- **0 rows past the bound** → every row is readable, so *"this link appears elsewhere"* and *"this
  link is reachable"* **converge**. The cheap uniqueness count is sound. (slang-fixer **reported** a
  12,351 B / 46-row index with 0 past, which would make the defect below **structurally impossible**
  there — ⚠️its filesystem, not mine; I could not verify it. The *structure* is load-bearing, not the
  byte count.)
- **Rows past the bound** → you MUST simulate. (Mine: 91,054 B, 80 of 107 rows past.)

⛔⭐⭐⭐ **THE TRAP, committed 08-05 and caught only by simulating.** I measured *"of the 35 lifeboat
links, **0 are unique** — all appear elsewhere in the index"* and was about to reclaim 6,787 bytes.
The closure diff said **0 orphans before, 11 after** — including a topic index and the parked-chains
index. **"Appears elsewhere" counted occurrences anywhere in the file, including rows PAST the bound
— so every link that looked redundant was redundant only with something already invisible.**

⇒ **A uniqueness or parent-COUNT check is fooled by three things** a closure diff is immune to:
self-references · mentions that aren't links · **parents whose own row is past the cut.**

⇒ ⛔⭐⭐ **The valid form — simulate on a copy, diff the orphan SETS:**
```python
def orphans(text):                      # links in the readable prefix, then depth-2
    pre = text.encode('utf-8')[:24400].decode('utf-8','ignore')
    inpre = L(pre); reach = set()
    for c in inpre:
        if os.path.exists(c+'.md'): reach |= L(open(c+'.md').read())
    return [d for d in L(text)-inpre if d not in reach]
before = orphans(s); after = orphans(trial_without_the_rows)
```
Report `set(after) - set(before)`. **Never the count** — counts hide *which* file went dark.

## ⛔⭐⭐⭐ A PASSING CONTROL THAT COULD NOT HAVE FAILED

slang-fixer ran this closure diff on its own store, got `0 newly-unreachable`, and reported it as
validating the instrument. **It only reflected its store's shape** — with 0 rows past the bound the
check had nothing to detect. What kept it safe was **being under the bound, not running the check.**

⇒ ⭐⭐⭐ **A clean result from a probe that could not have failed is indistinguishable from a clean
result from a probe that did work** — same shape as the inert guard, the vacuous `CHECK-NOT`, and the
survivor-percentage. **Before believing a green, ask what input would have made it red.** If you
cannot name one, the probe measured nothing.
⇒ ⭐⭐ **Scope a rule to the condition that makes it bite.** "Always run the closure diff" is true
and *hides why*, inviting a clean pass on a small index to be credited with teeth it never exercised.
⇒ ⭐ **Naming a failure mode does not inoculate against it** — the fixer described this class an hour
before committing it, and I committed the "correct number, narrower question" version while
correcting someone else's.

## ⛔ A reachability repair GROWS the file and can darken what it protected

08-05: adding lifeboat links for 12 dark files pushed the orphan count to **19**. Adding more links
lost ground every pass. **What converged it was trimming my OWN newest rows** — counter to the
instinct, which is to protect what you just wrote.
⇒ **Re-run the closure AFTER every repair and expect to iterate. Report the count you re-measured,
never the one you predicted.** Sequencing that makes spillover safe (slang-fixer's, as a safety
property not a style): **write child → confirm every entry landed → confirm the child's links resolve
→ pointer-ise the parent → closure diff shows 0 new orphans.** Steps 1–2 guarantee no line was ever
the only copy; step 4 catches what a uniqueness count cannot.
