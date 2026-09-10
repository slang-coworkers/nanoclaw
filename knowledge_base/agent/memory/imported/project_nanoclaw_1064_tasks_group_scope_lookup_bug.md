---
name: project_nanoclaw_1064_tasks_group_scope_lookup_bug
description: "nanoclaw#1064 (szihs, MERGED fcb39e4f) fixes the group-scoped `ncl tasks list` blindness that made my empty task list look like a display artifact — mechanism confirmed on my edge, counts NOT reproduced, and the fix is now LIVE here (verified 08-04T10:40Z, bare list returns 6 series)"
metadata:
  node_type: memory
  type: project
  originSessionId: d54ff4aa-6ad6-441d-b2fb-5c076ce02658
---

# nanoclaw#1064 — group-scoped `tasks` lookup misses tasks in ordinary sessions

`slang-coworkers/nanoclaw#1064`, author **szihs** (Harsh Aggarwal, NVIDIA — a **human**, not a bot),
base `nv-main`, head `fix/nv-main/tasks-list-group-scope` @ `badc08ddbd8ac`, 3 files +52/-3.
**MERGED `fcb39e4f` 2026-08-04T08:15:19Z by szihs himself, ~3 min after opening** — before any
review could land. CI at head sha was all-green (`check`/`ci`/`label`, suites 83765273584 /
83765273501 / 83765271397). Zero reviews, zero comments.

**Sibling, same day:** [[project_nanoclaw_1065_reclaim_before_wake]] — szihs's *next* human code PR
on this repo, also self-merged in minutes, also no-routed. That one is where the no-route rule got its
**second leg** re-derived (the repo runs no review bot ⇒ an approver would have no harvest input).

## Routing disposition — NOT routed to an approver

The `pr_ready_for_review` webhook carried the generic post-#874 task string *"route to the project's
`*-pr-approver`"*. **Standing rule overrides** (same class as #1050/#1063 — see
[[project_nanoclaw_pr874_webhook_route_approver]] and [[project_nanoclaw_kb_sync_pr_autoref_noop]]):
this is the NanoClaw **platform** repo, which has **no `*-pr-approver` coworker wired**; only
`slang-pr-approver` / `slangpy-pr-approver` exist, scoped to the compiler repos. Pointing a Slang
*compiler* approver at a nanoclaw-host TypeScript PR is nonsensical. **Also already merged** by the
time I finished reading it — so no approval decision was even available to make.
⇒ **Handled inline by Main. No dispatch.** *Diverges from #1050/#1063 in one way worth noting: this
is a **human-authored code** PR, not a bot data snapshot — the no-route conclusion is the same but
rests on "no approver wired for this repo", not on "it's automated data".*

## The bug — and why it matters to me specifically

`selectedSessions()` in `src/cli/resources/tasks.ts` used `findTaskSessions(group)` for **any**
group-scoped lookup. That query (`src/db/sessions.ts:161`) requires:
```sql
messaging_group_id IS NULL AND (thread_id = 'system:tasks' OR thread_id LIKE 'system:tasks:%')
```
Every **agent** caller is group-scoped (`groupArg` forces `ctx.agentGroupId` and ignores `--all`), so
a task row parked in an ordinary session fails the predicate and is **structurally invisible** — the
CLI answers `No tasks.` **with exit 0**. Host `--group` had the same blind spot; only the global
no-`--group` path worked, because it scans every active session via `getActiveSessions()`.

**My own tasks are exactly that shape.** `sess-1776713576150-9fon2n` (created 2026-04-20) has
`thread_id = NULL` **and** `messaging_group_id = mg-1776713211742-om8syu` — failing *both* halves.

Fix: a new `getActiveSessionsForGroup()` (plain `agent_group_id = ? AND status='active'`), so the
group path scans the same way the global path does, narrowed to the group. The per-DB `kind='task'`
filter still decides what counts as a task, so task-less sessions contribute nothing.
`findTaskSessions` is left in place — after the change its only **production** reference is the
explanatory comment; remaining callers are `src/templates/create-agent.test.ts` (×3). Verified by
absence-ladder on merged `nv-main` with a non-zero control.

## MINE-VERIFIED on my edge — 2026-08-04T08:46Z (host up since 08:13)

```
ncl tasks list                                       → "No tasks."   exit 0
ncl tasks list --all                                 → "No tasks."   exit 0
ncl tasks list --session sess-1776713576150-9fon2n   → 5 live series ← THE CONTROL
```
The `--session` path goes through `ownSession()` and **skips the group branch**, which is why it sees
what the group path cannot. ⭐⭐**That asymmetry is the entire diagnosis, and it is one command.**

✅**NOW LIVE — RESUME TRIGGER DISCHARGED 2026-08-04T10:40Z.** Bare group-scoped `ncl tasks list`
returns **6 live series** (was `No tasks.` at 08:46Z), so the merged code is deployed on this host and
[[feedback_watchdog_ncl_tasks_list_empty_not_a_freeze]] can drop its not-live warning.
*The earlier "fixed in source, NOT LIVE here" reading was true when written at 08:46Z and is now
superseded — a merge is still not a deployment, but this one has since been deployed.*

⚠️**Scope limit on the discharge — one arm of the 10:40Z re-run was NOT a control.** I re-ran
`ncl tasks list --session <id>` with an **arbitrary** session id harvested by `grep -oE 'sess-…' | head -1`
(`sess-1785839498150-d2svmp`), **not** the task-owning `sess-1776713576150-9fon2n` above. It returned
`No tasks.` — which is the *correct* answer for a session that owns none, and therefore says nothing
about the fix. ⭐⭐**The bare-line flip alone carries the discharge; that second line was theatre.**
⭐**A control has to be bound to the entity whose behavior you are claiming — an id that merely has the
right SHAPE is not the right id.** Count note: 6 series now vs 5 at 08:46Z vs the PR's 11 —
**the mechanism discharges, the numbers never travel.**

## ⛔ The PR's counts do NOT reproduce on my edge

It claims "the Orchestrator has 11 live task series (524 task rows)" in that session and a dead `*/5`
heartbeat series (53 failures, 18 days dead) that the watchdog couldn't re-arm. Measured:

| series | recurrence | runs | failed |
|---|---|---|---|
| `task-1780670816061-rgq8eo` (/supervise-issues) | `0 */12 * * *` | 144 | 0 |
| `task-1783328238990-qikxwn` (scheduler watchdog) | `0 */6 * * *` | 115 | 0 |
| `task-1777308843998-o6r5su` (nightly CI trigger) | `0 0 * * *` | 93 | 0 |
| `task-1777346910467-p0dxfu` (release CI report) | `30 1 * * *` | 92 | 0 |
| `task-1782828347850-4m9u23` (learnings-wiki synth) | `0 6 * * *` | 30 | 0 |

**5** live series, not 11. **0** failures anywhere, not 53. **No `*/5` series at all.** Probing all
10 plausible sessions in my group (`thread_id NULL` or `system:tasks*`, from a `--limit 10000`
enumeration) finds task rows in **exactly one**. ⇒ ⭐⭐**Mechanism confirmed, magnitude refuted —
adopt the diagnosis, never inherit the numbers.** (Its 11/524 may count `completed`/`failed` history
rows and cancelled series that `tasks list` hides; unresolved, and not worth resolving.)

## Instrument defects I committed while verifying this — all one shape

Three wrong measurements, each a correct query over an **unverified scope**:
1. **"79 active sessions in my group, 0 with tasks."** `ncl sessions list` **silently caps at 200
   rows, newest-first**; my session predates the page. At `--limit 10000`: **823**. Second victim of
   this cap in one day — [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]].
2. **`--status all` → "0 rows."** It is **invalid-args** (`pending|paused` only). I read an *error*
   as an *empty set*. ⭐**Check `ok`/exit before interpreting blank-looking output.**
3. **An 823-session probe timed out at 10 min having written nothing** — so "0 hits" was
   indistinguishable from "never ran." ⭐**A long sweep must emit per-item output or its silence is
   uninterpretable.**

Filed as a shared learning: *a negative tool result is a claim about the QUERY, not the world — find
the control that bypasses the suspect path*
(`/workspace/shared/learnings/` 2026-08-04). Related:
[[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_search_code_total_count_is_not_a_file_count]].

## Residual observations (not filed upstream — repo is szihs's, already merged, no ask made)

Not defects I can prove harmful, recorded only so a future reader doesn't re-derive them:
- `getActiveSessionsForGroup` is near-duplicate of the existing `getSessionsByAgentGroup`
  (differs only by `status='active'` + `ORDER BY`) — a one-source-of-truth smell, not a bug.
- Widening `selectedSessions` widens **every** verb that fans out through it, including
  `cancel --all` (`cancelAllTasks` per session) — the blast radius now covers ordinary sessions, and
  the added test covers only `list`.
- The new test parks a row in a session with `messaging_group_id: null`, whereas the production
  session that motivated the fix has one **set**. It still discriminates (the old `system:tasks`
  thread-id predicate fails either way), but it doesn't reproduce the reported shape exactly.
