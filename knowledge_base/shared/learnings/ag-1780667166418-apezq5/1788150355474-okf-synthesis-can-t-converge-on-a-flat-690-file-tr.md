---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787042935301-1j96e1
written_at: 2026-08-31T04:25:55.474Z
---

# OKF synthesis can't converge on a flat 690-file triage pile — needs a bulk issues/ migration, not 4-folds/day

The slang-triager OKF memory tree (`/workspace/agent/memory/`) has ~690 loose `triage-<N>.md` /
`comment-<N>.md` memos at the root plus 287 in `imported/`. The `/okf-synthesis` daily gate fires
every day with a ~2.4M-char backlog: **574 NO-FRONTMATTER, 133 DOSSIER, 16 OVERSIZE, 1 INDEX-STALE**.

Two structural facts make the standard fold (≤4 offenders/run, cron compounds) unable to converge:

1. **INDEX-STALE is inherent to the flat pile.** The scanner flags any folder `index.md` that
   doesn't link every sibling `.md`. With ~690 root-level memos you physically cannot link them all
   from the always-loaded `index.md` (16k budget), so INDEX-STALE is *permanent* until the memos move
   into an `issues/` subfolder with its own on-demand index. This is already noted as "the standing
   structural fix" in the index but is beyond a single run's bounded fan-out.

2. **The top OVERSIZE/DOSSIER offenders carry LIVE chain state** (e.g. `imported/project_issue_11917.md`
   = OPEN epic tracker; `triage-12426`/`triage-12380` = re-opened dossiers with in-flight PRs). Folding
   them means *pruning* live obligations — a human call, not an autonomous distill. So the largest-first
   rule keeps pointing at files that shouldn't be autonomously folded, and `finalize` ESCALATEs on the
   unchanged top offender every run.

**What DID work autonomously per run (safe, high-value):** trimming INDEX-BLOAT (moved a long scratch
list out of the always-loaded `index.md`, 12.4k→2.1k), distilling pure *lesson* files
(`feedback_*` — no per-issue state to lose: 46.9k→14.3k, 31.1k→12.0k), and repairing DANGLING-LINK
false-positives (prose documenting `](x·md)`-shaped patterns — reword to break the literal token).

**Recommendation to the owner:** the convergence blocker is not the fold logic, it's the flat layout.
A one-time bulk migration of `triage-*.md`/`comment-*.md` into `memory/issues/` with a generated
on-demand `issues/index.md` (which resolves INDEX-STALE and NO-FRONTMATTER at once by giving each a
`type:`), then let the daily cron maintain it. Doing this incrementally at 4/day would take ~150 days.
