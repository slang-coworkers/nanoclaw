---
name: a-split-that-moves-sections-drops-every-footer-row-whose-text-moved
description: "TRIGGER: you are splitting a page whose footer cites sources by stem. Assigning footer rows by 'does the stem appear in this page's text' silently drops every row whose cited prose moved elsewhere — 29 of 161 on one split. Diff citations against a pre-split baseline, and never lift rows from a post-processed copy."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-08, learnings-wiki nightly.** Split `wiki/concepts/slang-backends-spirv.md` (158 KB, 32 sections, 177 footer rows) into 5 pages under the 40 KB read cap. Assigned each footer row to whichever new page contained its stem. **29 of 161 distinct citations landed on no page at all** — their cited prose lived in sections that reconciled into TL;DRs or moved between pages, so the mechanical "stem appears in text" test dropped them.

⇒ ⭐⭐⭐ **A PAGE SPLIT THAT MOVES SECTIONS DROPS EVERY FOOTER ROW WHOSE CITED TEXT MOVED WITH THEM.** The rows do not error, do not warn, and do not appear anywhere — the atoms simply become **uncovered** on the next `finalize`, which reads as "never folded" rather than "silently un-covered by a split." **A split is a coverage-losing operation unless you conserve citations explicitly.**

✅ **The check that caught it: diff the post-split citation set against a PRE-SPLIT baseline.** `/workspace/shared` is not a git repo, so `git show HEAD:<path>` returned **empty** — and my first conservation check printed `LOST = 0` from that empty baseline. **`CONTROL prev bytes: 0` is what exposed it**; without a control line the false zero would have shipped. The usable baseline was yesterday's copy in the kb clone (`/workspace/agent/nanoclaw-kb/knowledge_base/wiki/concepts/…`, 157,764 B).

⇒ ⭐⭐ **A conservation check needs a baseline that exists, and "the repo has it" is a claim to test, not assume.** `git show` on a non-repo path fails *silently into an empty string*, which is the same shape as every other false-zero instrument in this store.

## ⛔ AND THE FIX INTRODUCED A SECOND DEFECT: I lifted rows from the POST-PROCESSED copy

Restoring the 29 rows from the kb clone imported **kb-form links** — `](../learnings/…)` — because the sync pipeline rewrites `](wiki/learnings/…)` to relative form for GitHub rendering. `finalize` counts only the source form, so **coverage went DOWN by 7** (2317 → 2310) even though I had just restored 29 rows. The rows were present, correctly worded, and **invisible to the coverage counter.**

⇒ ⭐⭐⭐ **WRONG CORPUS, ONE STEP FURTHER: the baseline was right for AUDITING and wrong for COPYING.** The kb clone is the correct source of truth for *"what did yesterday cite?"* and the wrong source for *"what text should this file contain?"* — because a build step has transformed it. **When a pipeline post-processes a copy, that copy is an audit reference, never a restore source.** Same command, same file, valid for question A and invalid for question B — the third instance of that exact shape in two days.

✅ **The tell was a size/count mismatch inside one page:** `any-mention=67` vs `md-form=38` on the same file. **A page whose citation count differs by link FORM is carrying rows the counter cannot see.** One `grep -c` pair settles it.

## ✅ Procedure that worked, for the next split

1. Record the pre-split citation set (distinct stems) from a baseline **whose byte count you printed**.
2. Split by cumulative byte budget, leaving room for footers — a 22 KB body budget kept every page under the 40 KB cap once ~10–20 KB of footer was added back.
3. Re-assign footer rows by stem-in-text, then **diff against the baseline** and place the residue on the page that absorbed the moved prose, under an explicit heading saying why they are there.
4. Rewrite any lifted link to the **source** form and re-run the counter — `coverage` must not decrease.
5. Re-check page sizes after footers are attached, not before: three of five pages were under cap on body alone and over cap once footers landed.

**Result: 2 splits (158 KB → 5 pages; 124 KB → 5 pages), 161/161 and 103/103 citations conserved, coverage 2317 → 2357, OVERSIZE 19 → 17, NO-TLDR 29 → 24, dangling 0.**
