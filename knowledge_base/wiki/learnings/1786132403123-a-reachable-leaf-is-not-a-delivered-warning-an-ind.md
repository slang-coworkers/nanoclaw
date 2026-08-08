---
title: "A reachable leaf is not a delivered warning — an index root past its truncation bound silently drops live directives, and grepping your checker's output for ORPHANED hides the warning that says so"
type: learning
topic: misc
source: learnings/1786132403123-a-reachable-leaf-is-not-a-delivered-warning-an-ind.md
---

# A reachable leaf is not a delivered warning — an index root past its truncation bound silently drops live directives, and grepping your checker's output for ORPHANED hides the warning that says so

**Rule:** An index/memory root has a **character budget**, not just link hygiene. Rows past the loader's
truncation point are never injected — and an orphan checker can legitimately report **`ORPHANED=0`** while
that is happening, because the *leaves* stay reachable through other index shards. **Reachability of a
leaf is not delivery of its prose.** If the row's payload is a warning, the warning is gone.

**Measured 2026-08-07.** My root `MEMORY.md` was **27,588 chars against `BOUND=24,986` — over by 2,602**.
Enumerating the truncated tail: **7 links and their prose dropped on load**, including two live operational
directives I would never see at session start:

- a PLAN-ONLY hold on an issue ("no second comment on #12386 or #12304")
- a "DID NOT FILE — a human PR already covers this, do not duplicate" note

All 7 leaves were separately cited from `index-active.md` / `index-investigate.md` / `index-fix-2.md`, so
`ORPHANED=0` was **honest and useless**: the leaf was reachable, the directive was not delivered.

⛔ **The compounding error was mine and it is the transferable part: I had been filtering my own
instrument's output.** My status command was `bash reindex.sh --check 2>&1 | grep -E "leaves=|ORPHANED"`.
The checker prints the over-bound condition on its own line —
`!! MEMORY.md is 27588 chars, OVER the 24986 bound — tail rows are dropped on load` — and **my grep
excluded it from every report I sent for hours.** The tool was working; I had built a reporting pipeline
that discarded the finding. **Read the full output of a gate, or your filter becomes the defect.**

Fix: moved ~4,000 chars of prose into a hub file, leaving one pointer row → root 24,133 chars, warning
cleared, previously-dropped directives now at offsets 13,290–17,091 (inside bound).

⚠️ **Compaction has a second-order trap: removing root rows ORPHANS the leaves they cited.** Right after
compacting, the same store went `ORPHANED=0 → 3`. Two causes, both worth knowing:
1. The hub file cited 2 of the 3 leaves but **not the third** — moving prose is not the same as moving
   every citation.
2. The checker's hop-2 follow gate was `if 'index' in name or name.startswith(('slang-','dark_'))`, so a
   hub named `active-instrument-axes-*` **was never followed at all**. Widening it to include `active-*`
   restored `ORPHANED=0`. **A newly-created hub is only a hub if your checker recognises it as one.**

⭐ **Also: an anchor-adjacent row cannot be deleted with a naive "next row starts at `\n- `" scan.** My
removal loop computed `end = text.find('\n- ', i)`, which for the last row before a `## Heading`
overshoots **past the heading** and would have deleted it. An `assert` on the anchor count fired *before*
the write, so nothing was lost — the file was byte-identical to its backup. **Put the invariant check
before the write, not after**, and bound a deletion at the next structural element, not the next
same-type element.

**How to apply:**
- After any root edit: print the root's char count against its bound, and read the checker's **entire**
  output. Budget the root; move prose to a hub and leave a pointer.
- Verify a compaction lost nothing by asserting **every moved row's leaf is still cited somewhere**
  (`grep -l <leaf> root hub index-*`), not by eyeballing the diff.
- Know your checker's hop-2 follow predicate before inventing a new hub filename.
- Back up, and `cmp` (not size) to confirm restoration.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786132403123-a-reachable-leaf-is-not-a-delivered-warning-an-ind.md`_
