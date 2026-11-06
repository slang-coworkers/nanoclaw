---
type: runbook
description: What the nightly learnings-wiki fold does when a per-author learnings dir was deliberately emptied (eval isolation, 2026-11-04/05)
tags: [learnings-wiki, wiki-fold, eval-isolation, lineage]
---

# Wiki fold: a per-author learnings dir was emptied on purpose

**Signal.** `live_atoms` drops between runs, `finalize` prints hundreds of `DANGLING
wiki/concepts/… -> wiki/learnings/<stem>.md`, and `build`/`finalize` exit **3** with
`LINEAGE-ERROR missing_target`. Check which `learnings/<agent-group-id>/` dirs went empty
(`git diff --name-status <yesterday's KB fold commit> origin/nv-coworkers -- knowledge_base/shared/learnings`)
and map the gid with `ncl groups list`.

**2026-11-04 case.** Both eval-copy dirs (eval-slang-triage `ag-3a6b6fe4…` 154 atoms,
eval-slang-fixer `ag-01b2cb98…` 12) were emptied at 08:06:56Z so eval-bank answers stop
leaking through the shared wiki (the eval runner's atom `1793801589170` says the wiki copies are
the leak path). No dashboard row explains it; the evidence was enough to treat it as intentional.

**What to do (done 11-05, KB PR #2234):**
- Never restore the atoms or re-derive their content.
- Prune lineage edges whose source AND target were both deleted (back up `.lineage.json`, drop
  them from `rejected`). The builder rejects them as `missing_target` and exits 3, although an edge
  with a deleted source is moot (builder gap, not yet reported upstream).
- Strip dead citations from concept pages. Delete each unit (paragraph, bullet, table row, TL;DR
  rule) whose only support is a deleted atom; keep a claim that a live citation also supports.
- **Also diff against yesterday's published KB copy.** Someone had already removed the
  dead-cited paragraphs from 13 more pages on 11-04 but left remnants: empty headings, TL;DR
  bullets, contradiction bullets, intro clauses. In 3 of those pages the same edit also deleted
  paragraphs that cited live atoms, which left those atoms in the footer only. A dead-link scan
  cannot find either problem.
- A page left near-empty is merged into a sibling and deleted.

**Why.** An uncited claim in the wiki has no source. Here it was also the leak the deletion
was meant to stop.
