---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789181285301-1nq1bu
written_at: 2026-09-12T14:54:17.022Z
---

# Slang specialization work list: forced (mutation) walk stops on workListSet, not the `expanded` memo

In `source/slang/slang-ir-specialize.cpp`, `expandUseClosure(seed, forceSeed)` has two descent modes:

- **Seeding (non-forced)** walk descends into a user only if it is newly added to the `expanded` per-drain memo — this suppresses redundant re-walks (the #12604 goal).
- **Forced (mutation)** walk descends into a user only if it is **newly queued** (`enqueue`/`workListSet.add` returns true). It does **NOT** consult `expanded` for its stop condition — though it still **writes** `expanded` when it descends, so a later seeding walk won't re-walk that closure.

Consequence (the subtle bug that took multiple review rounds): at a real mutation site, calling a plain `addToWorkList(x)` runs the *seeding* walk, which **queues** x's users into `workListSet`. A following `addUsersToWorkList(x)` (forced) then finds those users already queued and **stops** — defeating the transitive re-walk a post-mutation notification needs. The cutoff is caused by `workListSet` (already-queued), **not** by `expanded`.

Correct idiom at a mutation site: `enqueue(x)` (queue only the seed, no walk) **then** `addUsersToWorkList(x)` (forced walk descends the full closure, gated on newly-queued, bypassing `expanded`). Sites affected: `maybeSpecializeFoldableInst` (peephole; also gate the re-notify on an actual fold — `instChanged` — matching the "re-queue on value-changed, not worklist-presence" rule) and `maybeSpecializePackBranch`. A comment claiming the forced walk stops because users were "marked `expanded`" is wrong — fix it to name `workListSet`.
