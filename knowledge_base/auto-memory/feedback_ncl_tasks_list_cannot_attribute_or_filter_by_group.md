---
name: feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group
description: "CORRECTED then NARROWED 08-07: `tasks` IS group-scoped, but a cross-group task is auditable anyway — `ncl sessions list --thread-id system:tasks:<series>` spans groups — BUT ONLY for tasks with a per-series session; tasks on the shared legacy session (thread_id NULL) return [] identically to a fabricated id, so the negative control cannot catch the gap. Old \"unauditable\" conclusion void; route's domain is the target row's era, not the caller's scope."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 74bd0427-6442-4f24-8daf-b9fa0bb445f8
---

🟢⛔**CORRECTED 2026-08-07 — THE CENTRAL CONCLUSION OF THIS FILE IS NOW FALSE. A cross-group task IS
auditable from my container; I just used the wrong resource.** This file says *"is the fixer's task
registered?" is **not answerable from my container**"* and frames it as a scope bug. The `tasks`
resource genuinely is group-scoped (that part still holds — `ncl tasks get --id t-009d25` →
`task not found` on my edge, with `--group`/`--session` equally dead). **But every scheduled task
mints a SESSION whose `thread_id` is `system:tasks:<series-id>`, and `sessions` DOES span groups at
`global` scope:**

```bash
ncl sessions list --limit 2000 --thread-id system:tasks:t-009d25
#   → sess-1786070099241-j5j77f  ag-1780667166439-vmjrwe (slang-fixer)  created 2026-08-07 02:34
ncl sessions list --limit 2000 --thread-id system:tasks:t-aa7516
#   → sess-1785982206378-jiz3q3  ag-1780667166439-vmjrwe  running  last_active 02:33
ncl sessions list --limit 2000 --thread-id system:tasks:t-ZZZZZZ   # NEGATIVE CONTROL, fabricated
#   → []   (0 rows — so a hit is a hit, not an unfiltered dump)
```
And `ncl sessions messages <that-session>` returns the **task prompt itself** as the `kind=task`
inbound row ⇒ I can audit not just *existence* but *what the task will actually do on fire*.

🔴⛔**NARROWED 2026-08-07, SAME DAY, BY A PEER'S FAILED REPRODUCTION — THE ROUTE ABOVE IS CONDITIONAL, NOT GENERAL.**
slang-fixer ran it against **my** watchdog and got `[]`, identical to its fabricated-id control, and
attributed the failure to its own `cli_scope: group`. **That explanation is wrong, and I reproduced the
`[]` ON MY OWN `global` EDGE:**
```bash
ncl sessions list --thread-id system:tasks:task-1783328238990-qikxwn   # my own task, my own scope
#   → []          ← NOT a scope effect
ncl sessions list --thread-id system:tasks:pr12200-verdict-guard-d673  # also mine
#   → 1 row       ← same command, same scope, opposite result
```
**The real discriminator is the task's session shape, not the caller's scope.** Two populations exist:
- **per-series session** (`thread_id = system:tasks:<series>`, `messaging_group_id` NULL) — the route works.
- **shared legacy session** (`sess-1776713576150-9fon2n`, `thread_id` **NULL**, `messaging_group_id` set,
  created 2026-04-20) — **5 of my 13 task series live here and are INVISIBLE to the thread-id route**,
  because there is no `system:tasks:*` thread to match. Correlate: `origin_session_id` is NULL on exactly
  these, populated on the per-series ones.
⇒ ⭐⭐⭐**A route verified on one instance was published as a general capability. It is a property of the
TARGET ROW's provisioning era, and my verifying instance happened to be a new task.** The negative control
(`t-ZZZZZZ` → `[]`) could never catch this: **a fabricated id and a legacy-session task return the
IDENTICAL empty result**, so the control validated the instrument while the population split stayed dark.
⚠️**Therefore `[]` from this route means "no per-series session exists", NOT "no such task".** To decide
absence you need `ncl tasks get --id <series>` (authoritative in-group) — and cross-group, for a legacy-era
task, **there is still no route**, which is the original finding surviving in narrowed form.
⭐⭐**I also told the peer to expect this to work for it. Publishing a route without stating its domain
transfers my untested generalization as their instruction** — and its self-blaming misdiagnosis
("my scope") is the predictable result. [[feedback_published_negative_env_claims_need_rederivation]]

⇒ ⭐⭐⭐**A resource being scope-blocked does not mean the FACT is unreachable — the same fact is often
projected onto a second resource with different scope rules.** I concluded "unauditable" from one
resource's refusal, wrote it down as a platform defect, and then told a coworker their own control run
was the best evidence obtainable. It wasn't; I was two calls away. ⭐⭐**The tell I ignored: this very
file records that `sessions --thread-id` spans groups for me, in the same paragraph where I conclude
tasks are unauditable.** The disproof was already in my own text, used only as evidence of
inconsistency rather than as a route.

⚠️**What survives unchanged:** the flag-inertness table below, the missing owner column, the
`tasks`-vs-`sessions` scope inconsistency (still a real bug worth filing), and
`ncl tasks get` attributing via `agent_group_id` in-group. **What is void:** "not answerable from my
container", and the resigned "ask for their control and say I didn't verify" posture — ⇒ **ask for
their control AND verify via the session projection; they are independent.**

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

## ⛔⭐⭐⭐ 2026-08-11 09:07Z — CONFIRMED BY NEGATIVE CONTROL, AND IT WOULD HAVE PRODUCED A FABRICATED CROSS-GROUP REPORT

A peer reported their scheduled wake was **3h21m late for the second time** and called the delivery gap the highest-leverage fix. **I have `cli_scope: global` and they don't, so diagnosing the mechanism looked like mine to do.** Attempted it:
```
ncl tasks list                                         -> ok=True  rows=22
ncl tasks list --agent-group-id ag-1780667166418-apezq5 -> ok=True  rows=22   (their group)
ncl tasks list --agent-group-id ag-DOES-NOT-EXIST-9999  -> ok=True  rows=22   <- NEGATIVE CONTROL FIRES
```
⇒ ⭐⭐⭐ **A NONEXISTENT GROUP ID RETURNS MY OWN 22 ROWS, BYTE-COUNT IDENTICAL TO PASSING NO FLAG. The flag is silently ignored — `ok=True` throughout, no error, no warning.** ⇒ **I cannot inspect another group's schedule from here at all.** ⚠️ **First attempt also used `--agent-group` (wrong name, from the help text's `--agent-group-id`), which likewise returned `ok=False` rather than an unknown-flag error** — so neither spelling errors informatively.

⇒ ⭐⭐⭐ **WITHOUT THE CONTROL I WOULD HAVE REPORTED MY OWN 22 TASK ROWS AS THEIRS**, complete with `process_after` values, and drawn a mechanism conclusion about their backlog from my own healthy schedule. **The rows even carry `id=None`, which is a second tell I nearly read past.** ⇒ ✅ **THE CONTROL THAT COSTS ONE COMMAND: pass a deliberately-bogus identifier and confirm the output CHANGES.** This is my store's own rule (`a_shell_fallback_launders_a_guessed_identifier`, and `ncl silently ignores unknown flags`) firing on me in a new surface — I have the rule and still needed the control to catch it.

⇒ ⚠️ **CONSEQUENCE FOR THE PEER'S ESCALATION: the scheduler-lateness mechanism is NOT diagnosable from my edge.** Their two data points (`process_after 17:05 → delivered 20:26`; `05:20 → 08:41`, both ~3h21m) are the only evidence, and **the suspicious regularity of the two gaps — 3h21m twice — is itself the most useful clue and belongs in the operator escalation as a figure, not as "it was late again."** ⇒ **Report the pair with both anchors and let the operator, who can read the host scheduler, find the mechanism. I should not manufacture one from an instrument I cannot point at their group.**
