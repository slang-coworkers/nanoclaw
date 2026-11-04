---
type: incident
title: "Shared /workspace volume: review-eval trials leave 2–4 GB worktrees each (2026-11-03/04)"
description: The 11-03 eval-slang-reviewer runs used ~330 GB (103 leftover review worktrees) and pushed the 2.5 TB /dev/root volume below the 10% GC threshold; operator asked whether to clear them.
tags: [disk, eval, worktree-gc, fleet]
---

# Review-eval worktrees fill the shared volume

**Volume.** Since the July relocation, the fleet shares `/dev/root`, 2.5 TB, mounted at `/workspace`. Main
sees per-group usage read-only at `/workspace/extra/ephemeral/prod-groups/<folder>/`; `docker/` is not
readable. The old 251 G `/dev/vdb` wall is in
[../imported/project_fleet_disk_capacity_wall_11969.md](../imported/project_fleet_disk_capacity_wall_11969.md).

**The 11-03/04 episode.**
- slang-triager's worktree-GC gate reported 232 GB free (9.4%) at 00:07Z 11-04, with nothing to reap.
- Every group's `.worktree-gc/history.log` has an hourly free-GB line, and that line is the drain timeline:
  681 GB at 12:07Z, 325 GB at 21:07Z, 232 GB at 00:07Z.
- 12–21Z: **eval-slang-reviewer** (group `ag-7bc44bea…`, created 11-03 11:00, driven by Eval Compliance's
  eval-runner) ran 114 trial sessions. It kept **328 GB in 103 `wt-slang-pr-*` worktrees**. All sessions
  are closed and nothing was written after about 21:50Z.
- 21–00Z: normal slang-fixer and slang-reviewer builds, about 40 GB each.
- About 88 GB was freed between 00:07Z and 00:16Z by something I could not identify (no GC reaps), leaving
  320 GB.
- The GC never touches eval groups. Their worktrees are not PR chains.

**Asked the operator** at 00:19Z 11-04 on orchestrator-dashboard (thread `fleet-disk-pressure`, row 27):
clear the eval worktrees? who should do it? I also suggested the eval-runner remove each trial's worktree
after scoring. I told the triager not to free its STALE-OPEN or NO-PR worktrees (row 29).

**Method that worked.** Per group, run `find -mmin -N -size +50M` and sum the sizes, then `du -xs`
the suspect group. That takes minutes; a full `du` of 2.2 TB would not be practical.

**00:08–00:20Z 11-04, second report (slangpy-fixer, 232 GB).** I measured independently and got the same split:
- Writes in the last 2 h: slang-reviewer 45.7 GB, slang-fixer 25.7 GB, every other group ≤0.6 GB.
- Free space was 313 GB at 00:18Z, stable over a 45 s resample.
- The structural load is about 244 open bot PRs:
  - slang-fixer has 193 worktrees on OPEN PRs (protected), 1 on a MERGED PR and 21 that are variants or have no PR.
  - slang-reviewer keeps about 3 worktrees per reviewed PR: 154 on OPEN PRs, plus **11 on 7 MERGED PRs** (12410,
    13988, 14045, 14079, 14090, 14111), which I estimated at about 50 GB. The reap was done at 00:29Z and **freed only 8.2 GB**, because most had
    no `build/`. Saved work is in slang-reviewer `reaped/2026-11-04/`.
- The eval cleanup decision is still with the operator; I did not ask again.

**00:20–00:25Z 11-04, third report (slangpy-reviewer, 232 GB).** Another Main session handled this before I read the record above, so I sent the dashboard a duplicate heads-up (row 2885, thread `ops-disk-pressure-2026-11-04`). New facts from that pass:
- **309 GB of eval-slang-reviewer's 328 GB is in the `build/` dirs** of 66 of its 103 worktrees. Those dirs are regenerable. Deleting only `build/` keeps the trial sources and answers.
- eval-slang-fixer holds another **88 GB** of worktrees, with nothing written since 10-17 (it isn't in the 12-hour write list).
- `/workspace/extra/ephemeral/prod-groups/*` is **read-only for Main** (`test -w` fails), so Main can't do the reclaim. The operator or the owning group has to.
- Free space: 314 GB at 00:24Z, flat since 00:16Z.
- Re-check: one-shot `disk-pressure-recheck-4797` (11-04 03:00Z). It is gated to wake only below 12% free, and it alerts on thread `fleet-disk-pressure`.
- **Lesson:** grep `memory/orchestrator/` for the incident (here `disk`) BEFORE alerting the operator. Sibling Main sessions take the same report from several coworkers within minutes.

**GC discovery gap (slang-reviewer, 00:29Z 11-04).**
- Review clones made with `git clone` (from `bare-<pr>.git`) have their own `.git`. `worktree-gc-run.sh`
  finds trees only through `git worktree list` on the slang, slangpy and slang-rhi base clones, and its
  orphan pass skips any `wt-*` that has its own `.git`.
- So these clones are **never reaped**, even after their PR merges. That leak is permanent: 10 of the 11
  reaped dirs were such clones.
- Separately, `MIN_IDLE_DAYS = 1` in `worktree-gc.py` delays reaping by a day.
- I reported the gap to the operator. Fixing it is a change to the fleet tooling.
- Lesson: a reviewer worktree is about 0.5–5 GB, not 4.5 GB each. Measure with `du` before quoting reclaim figures.

**00:09–00:28Z 11-04, a third Main session (the #13376 chain) ran a parallel cleanup without first reading this note.** It authorized only regenerable deletions:
- slang-reviewer: 17 `build/` dirs in idle auxiliary worktrees, plus 2 merged or closed PR worktrees. **81 GiB.**
- slang-fixer: `build/` in 34 open-PR worktrees idle 3+ days, 1 clean no-PR worktree (branch kept), and stale `build-static` and `mtree` dirs. **261 GB.**

Free space rose to **575 GB (77%)** at 00:28Z. The eval-slang-reviewer worktrees were not touched, and that decision is still the operator's. ⇒ **On any disk alert, read this note and `grep -l disk memory/orchestrator/` FIRST.** Several Main sessions respond to the same alert, and the root cause may already be found.
- 00:31Z: the reviewer removed the 3 merged-PR bare clones (14045, 14079, 14090), freeing 332 MiB. It kept 16: 15 belong to OPEN draft PRs, and bare-14060 has no PR. The fleet reap is finished; remaining levers are with the operator (the 328 GB of eval worktrees, build/ caches, and expanding the volume).

**Lesson: a fleet-wide gate fans out to several Main sessions at once.**
- At 00:07Z every group's worktree-GC gate fired: slang-triager, slang-fixer, slangpy-triager and slangpy-fixer.
  Each report landed in a different Main session (om8v82, jlmg2z, nt7o84 and mine, wd0qod), and they all
  diagnosed the same problem in parallel. The dashboard got 4–5 separate disk messages within 15 minutes.
- **Before diagnosing a disk or CI alert, first grep `memory/orchestrator/` for the incident, and scan the
  active Main sessions** (`ncl sessions messages <sid> --reverse --limit 40` for each active Main sid).
  Then add only what is new, on the existing thread (`fleet-disk-pressure`).
