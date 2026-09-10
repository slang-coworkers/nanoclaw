---
name: feedback_ncl_tasks_scope_from_cron_session
description: RETRACTED 2026-08-05 — the "--session is the only thing that works" recipe INVERTED; --session now UNDER-reports (5 of 7) while bare/--all/--group return the full set
metadata: 
  node_type: memory
  type: feedback
  originSessionId: b11d41a9-cdaf-46f5-968e-33c4113882ff
---

# ⛔ RETRACTED 2026-08-05 — READ THIS BEFORE THE BODY BELOW

**The recipe below inverted.** Re-measured from a cron-fired session (`sess-1776713576150-9fon2n` — the same session id the body names), Aug-05:

| query | rows |
|---|---|
| `ncl tasks list` (bare) | **7** |
| `--all` | **7** |
| `--group ag-1776713211742-1w6l4e` | **7** |
| `--session $NANOCLAW_SESSION_ID` | **5** ⚠️ |

`--session` is now the **narrowest** view and silently drops 2 tasks that belong to my own group but run from *other* sessions — `memory-integrity-scan-958b` (`sess-1785885817946-px7p5a`) and `task-1781522302095-mjy6s1` (`sess-1781182947468-1j4tz8`). Following the old procedure, a watchdog sweep would have reported the memory-integrity scan as absent.

`ncl tasks update --id … --prompt/--script` also worked directly from this session (`touched:1`) with no `--session` scoping — contradicting the claim derived from this file in [[project_release_ci_babysitter_stale_run_reemit]] that a task edit had to be deferred to another session. That deferral delayed a real fix by weeks.

⭐⭐ **WHEN YOU RETRACT A RECIPE, GREP FOR WHAT WAS *DERIVED* FROM IT, NOT ONLY FOR ITS WORDING.** The costly descendant here shares no phrasing with the parent: this file says "`--all`/`--group` no-op over the session-DB transport"; the descendant says "can't edit the task from a cron-scoped session". A wording sweep finds the second one only by luck. Trace **referrers** (`grep -rl <slug>`) and read what each concluded — the retraction's blast radius is the set of *conclusions*, not the set of *quotes*. Cross-ref [[feedback_correction_unapplied_until_every_restatement_fixed]] (which sweeps by position and instrument; this adds the derivation axis).

⚠️ **False-zero note from this very check:** grepping the child for `EXECUTED instead of re-derived` returned **0** while the rule was present as "a recipe is what a later reader *executes instead of re-deriving*". A phrasing miss reads identical to a missing fact — verify by meaning before concluding a child lacks something.

⭐⭐⭐ **The single-case-rule failure mode, caught in the wild:** one observation + a plausible mechanism ("`--all`/`--group` are host-socket concepts that no-op over the session-DB transport") written up as a decisive recipe — and a recipe is what a later reader *executes instead of re-deriving*. The mechanism story is persuasive and may even still be true of some transport; the observable behaviour changed under it regardless.

⇒ **Procedure now: run bare `ncl tasks list` and treat its count as the population. If you add a scope flag, check the count does not shrink unexpectedly.** Both then and now the right instrument was a **cross-check between two scopes**, never a winner picked from one trial.

⚠️ Body below is retained as the dated Jul-16 observation, **not** a current recipe. The `list_tasks`-not-wired and field-name notes were not re-tested today — unverified, not disproven.

---

Scheduler-watchdog tick (2026-07-16): `list_tasks` MCP tool is **not wired** into the cron/fork session — only `ncl tasks` is available. And `ncl tasks list --all`, `--group <main-gid>`, `--status pending` **all returned empty** over the in-container transport, even though the recurring supervisor + watchdog tasks demonstrably exist (they fired the session).

**What works:** `ncl tasks list --session <owning-system-session-id> --json`. The tasks belong to main's *system session* (`sess-1776713576150-9fon2n` = `NANOCLAW_SESSION_ID`), and only a `--session`-scoped query surfaces them. Find your own session id in `env | grep NANOCLAW_SESSION_ID`.

**Why:** `ncl` in-container binds to the calling session's DB transport; `--all`/`--group` are host-socket concepts that silently no-op over the session-DB path (return `{ok:true, data:[]}` — a false "No tasks", not an error). Same silent-ignore-unknown-flag failure mode as `--thread-prefix`.

**Watchdog procedure that works:** `ncl tasks list --session $NANOCLAW_SESSION_ID --json`, then read `next_run` / `process_after` per row. The two cron tasks that read "due Nmin ago" with small N are usually the supervisor + watchdog *currently executing this very session* — never re-arm those (self-rearm is banned anyway), and <10min overdue is not stalled. Only re-arm genuinely-overdue (>10min) tasks via `update_task`/`ncl tasks update --process-after`.

**Field names (in-container JSON):** `series_id`, `process_after`, `recurrence`, `next_run`, `last_run`, `status`, `prompt`. Not the camelCase MCP names.
