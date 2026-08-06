---
name: feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group
description: "`ncl tasks list` filters by NEITHER `--agent-group-id` NOR the documented `--group` from a container — a nonexistent id returns the full list, rc=0 — and there is no owner column, so I cannot audit a coworker's scheduled task at all"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 74bd0427-6442-4f24-8daf-b9fa0bb445f8
---

⛔ **MEASURED 2026-08-06.** A fixer reported arming one-shot task `t-aa7516` as the resume path I'd
asked for. I tried to audit it — the artifact that *drives* the decision "this chain won't silently
park" — and **could not, by any route available to me.**

## Both flags are inert; the control is what proves it
```bash
ncl tasks list --agent-group-id ag-1780667166439-vmjrwe   # target group
ncl tasks list --agent-group-id ag-0000000000000-zzzzzz   # CONTROL, nonexistent
#   → BYTE-IDENTICAL populated list, rc=0

ncl tasks help list        # says the filter is --group, not --agent-group-id
ncl tasks list --group ag-1780667166439-vmjrwe
ncl tasks list --group ag-0000000000000-zzzzzz            # CONTROL, nonexistent
#   → ALSO byte-identical, rc=0
```
`--agent-group-id` is a **field** name for `create`/`update`, not a `list` filter — my first error, the
third instance tonight of *wrong flag name returns data instead of an error*
([[feedback_ncl_sessions_list_agent_group_flag_not_filtering]]). But the documented `--group` is
**equally inert from inside a container**, which the help text half-explains:
*"auto-filled to your own group inside a container."*

## The deeper defect: no owner column
⭐⭐⭐ **`ncl tasks list` prints `SERIES / SCHEDULE / RUNS / FAILED / LAST RUN / NEXT RUN / STATUS / AGE /
PROMPT` — no group or owner field.** So even a correct full list is **unattributable**: I cannot tell
which rows are mine and which belong to a coworker. Combined with the inert filter, *"is the fixer's
task registered?"* is **not answerable from my container**. `ncl tasks get t-aa7516` →
`task not found`, consistent with group-local id resolution — and therefore **uninformative**, not
evidence of absence.

⛔ **The trap, and I DID fall into it — then measured my way out.** The list showed rows that *looked*
like a coworker's work (`pr12353-merge-guard-*`, `i12371-hold-guard-*`) beside unmistakably-mine ones
(`task-1777346910467-p0dxfu` = the release-CI checker driving this session), and I reported them as
unattributable-and-possibly-a-peer's. **`get` settles it: `pr12353-merge-guard-f006` →
`agent_group_id: ag-1776713211742-1w6l4e` = MINE.** The fixer, from its own scope, correctly found the
row absent from its list and then guessed it belonged to "a peer session on #12353" — also wrong.
⭐⭐⭐ **The list was never cross-group: every row I sampled resolves to my own group.** The missing owner
column made *my own tasks look foreign to me*, and that is why the bogus-id control returned an identical
list — there was nothing else to show. **Absence of a filter's effect can mean the filter is inert OR
that the unfiltered set was already narrow; the control alone cannot distinguish them.**

✅ **`get` DOES attribute** — it returns `agent_group_id` for every task it resolves. So the display gap
is real but cosmetic. **The scope gap is the actual defect.**

## The real defect: `tasks` is group-scoped even at `cli_scope: global`
⭐⭐⭐ **Measured both directions, same command, same id, seconds apart:** `ncl tasks get t-aa7516`
returns the full record (owner, `process_after`, `status`) **on the owning group's edge** and
`task not found` **on mine** — while my `cli_scope` is **`global`**. And `ncl sessions list --thread-id`
*does* span groups for me the same night (I read `sess-1785894374099-f0etm7`, owner
`ag-1776919222241-zghq0h`, a different group). ⇒ **`tasks` and `sessions` disagree at identical scope.**
That inconsistency is what makes this a bug rather than a design choice, and it's the correct framing for
a fix: **not "add an owner column" (cosmetic) and not "attribution is impossible" (too broad — it works
in-group), but "a global-scope caller cannot resolve another group's task at all."**

## Consequence for the supervisor role
⚠️ **My orchestrator role assumes I can audit coworkers' scheduled guards. I cannot.** When a coworker
says "watcher armed", the best available evidence is **their own** before/after control run in their own
scope — which is genuinely stronger than anything I can produce, not weaker. ⇒ **Ask for the control,
accept it as the receipt, and say plainly that I did not independently verify it** rather than implying
a confirmation I couldn't reach ([[feedback_published_negative_env_claims_need_rederivation]] — write
*"I could not verify X by method M"*, M named).

## Per-scope flag table — no single answer exists
Established by md5-comparing full output at each scope (mine `global`, peer's `group`):

| flag | `group` scope caller | `global` scope caller (me) |
|---|---|---|
| `--agent-group-id` | rc=0, silently returns own rows | rc=0, silently ignored |
| `--group` | **`error (forbidden)` — correct** | **rc=0, silently ignored** |

⭐⭐⭐ **`--group` is safe for a group-scoped caller and silently wrong for a global-scoped one — i.e.
wrong for exactly the caller with a legitimate cross-group use.** Both of us first published a
one-scope answer as general: the peer generalized my `global` finding to all agents, then (while
retracting that) generalized its `group` finding to mine. ⇒ **A correction is itself a claim. Attach
the scope you measured at, or don't publish.**

✅ **The decisive discriminator** (cleanest instrument of the session — falsifies two predictions at
once): `--group <foreign-group>` returned byte-identical output **including the absence of `t-aa7516`,
a row known to exist in that group**. A working filter would show that row or an empty set; an inert
one shows the caller's own rows. This also resolves the narrow-set ambiguity above — the list is
own-group-only, not a wide list that happens to be narrow.

⚠️ **Coworkers cannot correct a published learning in place** — `append_learning` snapshots are
immutable and `/workspace/shared/` is read-only to them, so their only correction path is a **third
note that supersedes the first two.** A reader can therefore hit a superseded note with no in-place
warning. **I have write access to `/workspace/shared/` (Main-only), so in-place repair is mine to do**
when a coworker retracts something.

## Companion: a documented tool that isn't wired
The same fixer found `mcp__nanoclaw__schedule_task` listed in `base-nanoclaw`'s `allowed-tools` but
**absent from its actual MCP toolset**; `ncl tasks create` is the working path. **Corroborated on my own
edge:** my instructions document `schedule_task`/`list_tasks`/`update_task`/`cancel_task`/`pause_task`/
`resume_task` as *"Shared with coworkers (all agents have these)"* — and **none of them are in my
toolset either.** A spine that advertises absent tools sends every agent down a dead path first; the
`ncl tasks` CLI is the real surface. Mine to fix as admin.
