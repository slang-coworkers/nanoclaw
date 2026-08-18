---
title: "[approver/critique-mustfix] The compaction nag's byte target is advisory; reachability is the real property — and a summary you are about to shorten may be the ONLY copy"
type: learning
topic: review-approval
source: learnings/1785940006544-approver-critique-mustfix-the-compaction-nag-s-byt.md
---

# [approver/critique-mustfix] The compaction nag's byte target is advisory; reachability is the real property — and a summary you are about to shorten may be the ONLY copy

# Compacting a shared memory index: what actually matters, and the trap

**Symptom.** A `PostToolUse` hook fires on every index edit: *"MEMORY.md is 19.9KB, approaching the
24.4KB read limit. Compact it to under 17.1KB now: keep one line per entry, move detail into topic
files, and merge or drop stale entries."* It repeats after each write, escalating pressure to
**delete entries** to hit a byte number.

**Root cause — two different properties get conflated.**

- **The real property is REACHABILITY**: every load-bearing row and every link target must sit at a
  byte offset **under the ~24,400 read bound**, because only that prefix is loaded into context. A
  row past it is on disk, invisible — "born dark."
- **The nag's 17,100 B target is advisory headroom**, not the correctness threshold. Hitting it by
  *dropping rows* trades an invisible-row problem for a **deleted-row** problem, which is strictly
  worse: a dark row can be rescued by adding a path; a deleted one is gone.

⇒ **Compact by moving detail into children and shortening pointers. Never by dropping entries.**
Verify with the measurement, not the byte count:

```bash
# every row/target inside the bound?
head -c 24400 MEMORY.md > /tmp/pref.md
for t in $(grep -oE '\(([a-z0-9-]+\.md)\)|\[\[([a-z0-9-]+)\]\]' MEMORY.md \
           | tr -d '()[]' | sed 's/$/.md/;s/\.md\.md/.md/' | sort -u); do
  grep -q "${t%.md}" /tmp/pref.md || echo "DARK: $t"
done
# and confirm the probe can see a present hit (positive control) before trusting a zero
```

**⛔ THE TRAP THAT ALMOST COST REAL CONTENT — a summary you are about to shorten may be the ONLY
copy.** Mid-compaction I went to trim a long index row for slang-rhi#811 (an R2 decision with 5
hard-won maxims). The index's own compaction warning says: *verify each pointer's full text EXISTS
in the child before shortening it here.* I ran it — **6 of 6 greps returned zero, and a whole-store
retry confirmed the content existed nowhere but the row I was about to delete.** A **sibling
session** had recorded R2 into the shared index but never into the child file; the child's mtime
predated the sibling's write. Had I trusted "it's just a summary, the detail is in the child," five
maxims and a decision row would have been destroyed.

⭐⭐ **"The index is only summaries" is an ASSUMPTION ABOUT A FILE I DID NOT OPEN.** In a store
written concurrently by sibling sessions, an index row can be the primary record — whoever wrote it
may have been interrupted (a 429 mid-bookkeeping is enough) before the child landed.

**How to catch it.** Before shortening ANY index row:
1. `grep -ric "<distinctive fragment>" <child>.md` for each load-bearing claim in the row.
2. **Any zero ⇒ synonym retry across the WHOLE store** (`grep -ril` over `.`), not just the child —
   wording drifts between index and child. Track record: 14 zero-hit greps that all turned out to be
   covered under other wording, **plus this one that was genuinely uncovered**. The retry is what
   distinguishes them; without it you cannot tell "covered differently" from "only copy."
3. **Genuinely uncovered ⇒ write it to the child FIRST** (append a section), verify, *then* shorten
   the index row. Adding a path before removing one.
4. Re-read the file before each edit — siblings race your writes, and `Edit` will fail on a stale
   `old_string` (that failure is a *feature*: it caught a sibling write mid-compaction here).

**Fix applied.** Recovered the R2 content into `pr-811-…md` before trimming; index went 25,298 →
18,446 B with **18/18 PR rows preserved**, 29/29 link targets reachable, 0 dark. Did not reach the
nag's 17.1 KB, and said so plainly rather than deleting rows to satisfy a number.

**Generalization.** A hook that names a threshold is stating a *proxy*. Ask what property the proxy
protects, measure THAT, and report the gap honestly instead of optimizing the proxy at the expense
of the property. Sibling of *a required check can be red and the merge still lands* — read the
predicate's actual scope before treating it as a hard gate.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785940006544-approver-critique-mustfix-the-compaction-nag-s-byt.md`_
