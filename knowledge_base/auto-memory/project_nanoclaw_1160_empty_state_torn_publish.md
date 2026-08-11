---
name: project_nanoclaw_1160_empty_state_torn_publish
description: "nanoclaw#1160 (szihs) fixes both #1119 P1s — MERGED mid-review (head never moved, blobs identical on nv-main). Both fixes verified BY CONSTRUCTION. 2 findings live on nv-main: exit-0-empty ncl list wipes the snapshot (tasks.ts:108-110 skips a missing inbound.db silently), and commit()'s backup loop sits outside its own finally so a .rollback hard link strands un-gitignored."
metadata: 
  node_type: memory
  type: project
  originSessionId: d3982f37-f46f-4cd4-9026-ddbee892ab02
---

# nanoclaw#1160 — real empty state + honest torn-publish reporting

`slang-coworkers/nanoclaw#1160`, author **szihs**, branch `fix/nv-main/task-snapshot-publish`
→ `nv-main`. Head `d6db4398`. 2 files, +381/−29. Follow-up to both P1s of my
[[project_nanoclaw_1119_fail_closed_task_snapshot]] review.

⛔ **MERGED 2026-08-10T05:10:40Z by szihs while I was reviewing** (merge `fe6b3ce9`) — 5th
mid-review merge on this repo. ✅ **Head never moved** (`d6db439` at open and at merge) and both
blobs are **byte-identical on nv-main after the merge**, so every measurement below is of exactly
what landed. Review posted post-merge as findings against `nv-main`: comment **5236216042**.

**Routing: handled INLINE — 5th instance of the standing rule.** `pr_ready_for_review` again
carried the generic *"route to the project's `*-pr-approver`"*. Verified LIVE from this turn's
destinations block: only `slang-pr-approver` / `slangpy-pr-approver` exist, both repo-scoped
**compiler** approvers that return `ABSTAIN_POLICY` on a NanoClaw-platform PR. See
[[project_nanoclaw_pr874_webhook_route_approver]], [[project_nanoclaw_1074_scheduled_task_dump]].

## ✅ Both fixes verified BY CONSTRUCTION (not by reading)

Built an independent bash/fixture harness (`bin/ncl` stub) and drove the real script, both trees:

| construction | pre-fix | post-fix |
|---|---|---|
| md dest is a **directory** (my own #1119 repro, no fault seam) | `json_unchanged=NO`, `leaked_new_content=1`, stderr *"Nothing was replaced."* | `json_unchanged=YES`, leaked=0, message names what happened |
| `DUMP_TASKS_FAULT=crash:1` then `--check` | n/a | rc=**4**, `TORN PUBLISH` naming both ids ✅ |

- **Test counts confirmed by execution** (subagent, real vitest): **14 passed** post-fix,
  **8 failed | 6 passed** pre-fix — matches the body exactly. `python3` really present
  (`/usr/bin/python3`, 3.11.2); a missing interpreter would have failed all 14 identically.
  Tree restored clean afterward.
- **Consumer claim verified by EXECUTION:** ran `kb-doctor.py:152-157`'s exact `exec_module`
  importer against the new file — loads, `VOLATILE` still 11 entries. Body's *"checked by running
  them"* is accurate.
- **Every self-reported limitation is true:** committed prod snapshot really has only
  `instance`/`task_count`/`tasks`; `--check` on it really exits 4; `--check` really is not wired
  into CI (no `.github/workflows` reference). Declining to wire it was correct.
- Nice detector edge: a crash tearing a pair whose **content is identical** yields matching ids and
  `--check` correctly returns 0 — the pair really is equivalent.

## ⛔ Finding 1 (live on nv-main) — the empty-state fix rests on a false premise

The script *prints* its own load-bearing premise: *"a host/DB failure would have failed the list
instead of returning it empty."* Mostly true — and better than expected: `client.ts:53`
`process.exit(res.ok ? 0 : 1)` so `ok:false`→1; socket dead→2 (`:43`); a sqlite throw in
`withInboundDb` (`session-manager.ts:423-430`, `try/finally`, **no catch**) propagates to
`dispatch.ts` → `ok:false` → 1.

**But `tasks.ts:108-110` `withInbound` returns `undefined` when the inbound.db FILE IS MISSING, and
`:289-292` skips that session with no else/marker/error** ⇒ `ok:true, data:[]`, **exit 0**,
indistinguishable from "genuinely zero tasks". Constructed it: baseline 3 tasks → `task_count=0`,
`complete: true` written, rc=0. The artifact's own completeness assertion now vouches for a wipe.

⭐⭐⭐ **The compensating warning is silent in exactly the cases you'd want it** — it requires
reading the *previous* snapshot's `task_count`:

| previous state | rc | WARNING | new count |
|---|---|---|---|
| readable, 3 | 0 | yes | 0 |
| corrupt JSON | 0 | **no** | 0 |
| absent | 0 | **no** | 0 |
| `task_count` key missing | 0 | **no** | 0 |

Not hypothetical: the committed prod snapshot predates `complete`/`listed_count`, and
`except (OSError, ValueError, TypeError): previous = 0` swallows any future key change into a
**silent** wipe. And `--check` **cannot** see it — an empty pair is internally consistent, rc=0.

⭐⭐⭐ **The same file already holds the right discipline 12 lines away:** the `get` path checks the
PAYLOAD (`d = got.get("data") if (ok and isinstance(got, dict)) else None`), and
`kb-doctor.py:169-176` (same repo, same author) states the rule outright — *"absence has to be
ASSERTED by the application layer, never inferred from a failed process"* — checking `ok is False`
at `:188` BEFORE `returncode` at `:195`, a comment that records this bug class already biting once
(`exec: pnpm: not found` → "13 deleted tasks"). The `list` path is the one place that infers
absence from a process outcome.

✅ **Bounded in fairness:** a *closed* session cannot hide live tasks — `host-sweep.ts:386-394`
closes a task session only when `liveTasks == 0`, after recurrence re-arms. That path is defended.

## ⚠️ Finding 2 (live on nv-main) — stranded `.rollback` hard link

`commit()`'s backup loop is **lines 252-263, OUTSIDE the `try` at 265** whose `finally` (295-303)
sweeps backups. Failure creating backup *N* strands 1..*N*-1. Reproduced (md dest a directory →
`os.link` `PermissionError` on backup 2): `docs/` = `snap.json snap.json.rollback snap.md`, and
`ls -li` shows **inode 7005343 for both** — a live alias, not a stale copy. Refusal itself is
correct and the next successful run sweeps it, but `.rollback` is **NOT gitignored**
(`.gitignore:29` is `.tmp-*`, matching neither `.rollback` nor `.snap.md.xxxx.tmp`; verified with
`git check-ignore` → rc=1 for both).

⭐⭐⭐ **The suite's own omitted assertion would have caught it:** `docsListing(repo)` is asserted by
**2 of the 3** failure tests and omitted by **exactly the one that strands litter**
(`the JSON survives a second-target failure that owes nothing to fault injection`).

## Notes

- `_fault`'s docstring overstates itself: *"can only refuse to publish, never publish something
  wrong"* — `crash:n` does the opposite by design (that's why the `--check` test uses it).
- `session_id` still absent from `VOLATILE` — my #1119 finding 2, unaddressed, out of scope.
- **Provenance, stated carefully:** body cites `PR_1119_CODE_REVIEW_2026-08-06.md` for both P1s.
  Not in the tree, and it's on szihs's filesystem — I claimed nothing about it. My published #1119
  comment (`5205619012`) holds the torn-publish P1 but **not** the empty-list one, so only that half
  was traceable to a review I wrote. Per ANCHOR C: a file I cannot see is not a file that is absent.

**Write path reconfirmed:** `gh api repos/.../issues/1160/comments --method POST --input <json>`
with `json.dump`-built payload ✅. Merge was szihs's own (`fix/nv-main/*` outside the grant).
