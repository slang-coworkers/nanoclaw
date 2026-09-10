---
name: project_learnings_wiki_finalize_recount_recipe_stale
description: "learnings-wiki daily task: the prompt's manual-recount recipe is STALE; trust finalize's own count, not the [[…]] hand-recount"
metadata: 
  node_type: memory
  type: project
  originSessionId: 24ba7a33-9ff1-4b89-b9ce-7abc69b209cb
---

The daily learnings-wiki task prompt says: "finalize only prints the first 40; compute the true UNCOVERED set manually (a learning is uncovered unless a concept links it via `[[wiki/learnings/<file>.md]]` or `[text](wiki/learnings/<file>.md)`)."

**That recipe is stale against the current on-disk `/workspace/shared/.learnings_wiki.py` (dated Jul 6).** The embedded skill version used `LINK = re.compile(r"\[(?:[^\]]*)\]\((wiki/[^)]+\.md)\)")`, which does NOT match the nested-bracket citation form the concept pages actually use: `[[approver/clause-gap] text](wiki/learnings/…md)`. The on-disk `finalize()` was FIXED (line ~237) to `URL = re.compile(r"\]\((wiki/[^)]+\.md)\)")` — matching on `](url)` alone — precisely to count those honestly (see its inline comment: "Matching on `](url)` alone keeps coverage honest").

**Consequence:** a hand-recount using the OLD `LINK`/`[[…]]` rule over-counts uncovered (observed 2026-08-03: recipe→135, real finalize→2). The finalize `coverage N/N` line and its printed UNCOVERED list ARE the truth; the "40-print truncation" caveat only matters when >40 are actually uncovered.

**How to apply:** On the daily run, trust `finalize`'s own `coverage`/`UNCOVERED` output. If you want an independent check, replicate finalize's CURRENT regex (`r"\]\((wiki/[^)]+\.md)\)"`), NOT the `[[…]]` recipe. Don't burn a dozen tool calls re-litigating a 2-vs-135 contradiction — it's the recipe that's wrong, not the script. Flag to the operator that the task prompt should be updated to drop the manual-recount step (or point it at the `](url)` regex). Related: [[feedback_watchdog_ncl_tasks_list_empty_not_a_freeze]].
