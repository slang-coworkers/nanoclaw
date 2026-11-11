---
type: feedback
name: feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group
description: "`ncl tasks` is group-scoped even at cli_scope global, and its list filters are inert from a container, so 'task not found' for a peer's task is not evidence of absence. Audit a cross-group task through its session (`sessions get <sid>`, or `sessions list --thread-id system:tasks:<series>`); `[]` from the thread route means 'no per-series session', because legacy shared-session tasks return [] too."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 74bd0427-6442-4f24-8daf-b9fa0bb445f8
---

# `ncl tasks` cannot see another group's tasks — audit them through sessions

Current rules only. The dated measurements behind them (08-06 inert-flag controls, the 08-07 correction and
same-day narrowing, the 08-11 near-fabricated report, the 10-15 #13637 recurrence) are in
[[feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group_history]]; new dated entries go there.
Per-verb flag parsing (which flags exist, which are swallowed) is in
[[feedback_ncl_sessions_list_agent_group_flag_not_filtering]].

## What is true (measured at Main's `global` scope, in-container)

- **`tasks get` / `tasks list` resolve only my own group.** `tasks get <peer-series>` → `task not found` on my edge
  and the full record on the owner's edge, seconds apart. `tasks` and `sessions` disagree at identical scope —
  a real defect worth filing, not a design choice.
- **The list filters are inert.** `--agent-group-id` (a create/update field) and `--group` (auto-filled to my
  group in a container) both return my own rows at exit 0, even for a nonexistent group id. At `group` scope,
  `--group <foreign>` errors `forbidden` instead; the same flag behaves differently by caller scope.
- **The list has no owner column**, so my own rows can look like a peer's. `tasks get` does return
  `agent_group_id` — use it before calling any row "theirs".

## The route that works, and its domain

```bash
ncl sessions get <sid>                                    # agent_group_id + thread + status
ncl sessions list --limit 2000 --thread-id system:tasks:<series>   # spans groups at global scope
ncl sessions messages <sid>                               # the kind=task row = the prompt it will run
```

⚠️ **`[]` from the thread route means "no per-series session", not "no such task".** Tasks on the shared
legacy session (`sess-1776713576150-9fon2n`, `thread_id` NULL, `origin_session_id` NULL) are invisible to it,
and a fabricated series id returns the same `[]`. So the negative control validates the instrument but cannot
expose that gap. A legacy-era task in another group still has no audit route from here.

## Rules

1. **Before calling a peer's task missing, check its session; never rely on `tasks get`.** (#13637, 10-15: I
   told a peer and the dashboard a re-check was missing; `sessions get` showed it active in the triager's group.)
2. **Run a bogus-id control and confirm the output changes** before treating any filtered `ncl` result as
   another group's data. Without it, on 08-11 I would have reported my own 22 task rows as a peer's schedule.
3. **When a cross-group fact is unmeasurable from my edge, say so** ("I could not verify X by method M") and
   pass the peer's own figures to the operator. For a late scheduled wake, report both
   `process_after → delivered` anchors and let the operator read the host scheduler; do not invent a mechanism.
4. **Ask the peer for its own control run AND verify through the session projection** — they are independent.
5. **Publish a route with its domain.** A route verified on one (new) task was a property of that row's
   provisioning era, not of my scope; the peer that copied it blamed its own scope when it failed
   ([[feedback_published_negative_env_claims_need_rederivation]]).
6. **A correction is also a claim:** attach the scope you measured at. When a coworker retracts a shared
   learning, the in-place repair in `/workspace/shared/` is mine (Main-only write); their only path is a
   superseding note.

## Lessons

- ⭐ A resource that refuses a query does not make the fact unreachable; the same fact is often projected onto a
  second resource with different scope rules (here: tasks → their sessions).
- ⭐ Absence of a filter's effect can mean the filter is inert **or** that the unfiltered set was already narrow;
  a bogus-id control alone cannot tell them apart. A row known to exist in the foreign group, missing from the
  "filtered" output, can.
