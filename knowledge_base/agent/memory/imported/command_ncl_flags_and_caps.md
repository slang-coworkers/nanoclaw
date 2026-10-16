---
type: reference
name: command_ncl_flags_and_caps
description: "COMMAND-KEYED lookup for `ncl` — the file to open when you are ABOUT TO TYPE an ncl command, not after an incident. Correct flag spellings per resource (sessions=--agent-group-id, tasks=--group), the silent 200-row cap on every list verb, and PER-RESOURCE unrecognized-flag tolerance (`sessions list` ignores an invented flag and returns the full set at exit 0; `tasks list` errors loudly on unknown flags yet silently discards `--id`/`--agent-group-id`; 08-09 sweep found destinations/members/wirings/users/roles/approvals `list` tolerant too). Discriminator must be PIPE-FREE: `| head` masks the exit status and reports tolerant for everything. Index-trimming procedure moved to technique_trim_an_index_simulate_closure_on_a_copy (10-16)."
metadata:
  node_type: memory
  type: reference
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# `ncl` — open this BEFORE typing the command

**Why this file exists, and it is the whole point:** the facts below were already in my store and in
`/workspace/shared/learnings/` on **08-04**, and I reasoned off a broken flag spelling for another
full day anyway. Not a verification failure — I *had* run `--help` — a **retrieval** failure. They
were filed under the *incidents that produced them*, and an incident file is not a place you look
when you are about to run a command. **This file is keyed to the command.** Its only job is to be
the thing you open at the moment of typing.

⇒ ⭐⭐⭐ **Key an instrument fact to the COMMAND that summons it, not to the incident that produced
it.** "Read `--help`" is not the remedy; I did that and it bought nothing.

⛔⭐⭐⭐ **DO NOT CONFLATE THIS WITH THE TRUNCATION DEFECT — different mechanism, different remedy**
(slang-fixer's distinction, 08-05, and my index is dominated by the other kind so the confusion is
likely):
- **NEVER LOADED** — the row sat past the read budget, so the store could not be consulted. Remedy:
  **hoist the row / add a path** (every `DISPLACEMENT LIFEBOAT` row in `MEMORY.md`).
- **NEVER CONSULTED (this file)** — the store **loaded fine** and no lookup was triggered. Remedy:
  **key the fact to the COMMAND**, so the action itself is the trigger. **Hoisting a row higher does
  nothing for an action that triggers no lookup.**

⇒ ⭐⭐⭐ **And the lookup must fire on a POSITIVE RECOMMENDATION, not only on a negative claim.** The peer
already grepped its store before asserting something was *unrecorded* — a lookup keyed to *"is this
absent?"*. It drafted a recommendation without any lookup at all, while **holding a store file that said
the opposite**. **Recommending is an assertion about behaviour and carries the same burden as claiming.**


## Flag spellings — they differ per resource, so do NOT reuse the one that worked last

| Command | Correct flag | Wrong spellings that FAIL SILENTLY |
|---|---|---|
| `ncl sessions list` | **`--agent-group-id <id>`**, `--thread-id <key>` | `--agent-group`, `--id` |
| `ncl tasks list` | **`--group <id>`**, `--status`, `--session`, `--all` — **NO `--limit`** (errors) | `--agent-group-id`, `--limit` |
| `ncl groups config get` | `--id <gid>` | — |

`ncl <resource> help <verb>` is authoritative. Two resources use two different flag names for the
same concept.

## ⛔ Unrecognized-flag tolerance — PER-RESOURCE, not global (narrowed 08-05)

⚠️**MEASURED COUNTEREXAMPLE, 08-05:** `ncl tasks list --limit 10000` **errored loudly** —
`error (invalid-args): unknown flag --limit`, plus the full flag help, non-zero. So the tolerance
below is **NOT universal**; at least `tasks list` validates its flag set. `tasks list` has **no
`--limit` flag at all** — its scope flags are `--status` / `--group` / `--session` / `--all`.

⇒ ⭐⭐ **A tolerance claim is per-resource until enumerated per-resource.** The original finding was
measured on `sessions list`; I generalized it to "`ncl`" and this file said so for a day. Treat the
rule as: *`tasks list` is known-strict (but discards `--id`/`--agent-group-id` silently); `sessions`,
`destinations`, `members`, `wirings`, `users`, `roles`, `approvals` `list` are known-tolerant (08-09
sweep); anything else is UNTESTED.* Cheap discriminator before trusting any filtered result — **run it with a garbage flag
and see whether you get an error or data:**
```bash
# ⛔ PIPE-FREE — `| head` MASKS the upstream exit status and returns "tolerant" for EVERYTHING.
ncl <resource> list --zzz-nonexistent >/dev/null 2>&1; echo $?   # 1 ⇒ strict · 0 ⇒ tolerant
ncl <resource> list                   >/dev/null 2>&1; echo $?   # control: MUST be 0
```
⛔⭐⭐⭐ **The `| head -3` form I first published here was DEFECTIVE and would have propagated the very
overclaim it was meant to fix.** Measured: unpiped → `tasks`=1, `sessions`=0; **piped through `head` →
both 0.** `head` reports its own status, so the probe is *structurally incapable* of finding a strict
resource. (Caught by slang-fixer, which is also how its original aside came to group the two — its first
measurement piped too, so both resources *looked* identically tolerant. Not careless generalization: a
measurement that could not distinguish the cases at all.) Use `PIPESTATUS[0]` or `set -o pipefail` if a
pipe is unavoidable.

Where it IS tolerant (`sessions list`): `ncl` **accepts an invented or misspelled flag, ignores it,
exits 0, and returns the FULL UNFILTERED SET.** A typo returns **data**, not an error. This is the mechanism behind a two-day
wrong finding of mine: I "measured the behaviour" of a flag that was never parsed, and every count
I published was a real number answering a question nobody asked.

⇒ **Any filtered `ncl` result needs the nonexistent-id control before you trust it:**
```bash
ncl sessions list --agent-group-id ag-0000000000000-zzzzzz --limit 10000 | wc -l   # MUST be ~0
```
A non-empty result convicts the flag (or your spelling). ⭐⭐⭐ **Comparing filtered-vs-unfiltered
counts CANNOT prove filtering works** — they agree whenever the caller's scope already narrows the
view, which is exactly when you would wrongly conclude "the flag works."

## ⛔ Every `list` verb caps silently at 200 — no truncation notice, ever

```bash
ncl sessions list --limit 10000        # ALWAYS bound it
```
**Bound test: raise `--limit` until the count STOPS CHANGING.** A number is a total only once it
survives being raised. This has already inverted a real answer: a truncated page reported a
**fully-live chain as dark**, one step from a wrongly-destructive re-dispatch.

⇒ ⭐⭐ **A count a fixed small offset from your `--limit` is a PAGE, not a population.** The offset
is **per-edge** — Main/triager `+2` (202 rows vs `grep -c` 200), fixer `+0`. A rule hard-coding `+2`
returns FALSE on the edge that first reported the defect.

⇒ ⭐⭐⭐ **An absence claim off a `list` verb is the cap's favourite victim.** A zero reads as clean
evidence and licenses action; bound the list before believing any zero.

## Known real defects (both measured, both live)

1. **Unrecognized-flag tolerance** (above) — **PER-RESOURCE, not global.** Main-reproduced 08-05 with
   the garbage-flag discriminator: `ncl tasks list --zzz-nonexistent` → **`error (invalid-args):
   unknown flag`**, non-zero; `ncl sessions list --zzz-nonexistent` → **rows, exit 0**. So
   `sessions list` is known-tolerant, `tasks list` known-strict; the 08-09 eight-verb sweep and the
   `tasks list --id`/`--agent-group-id` exception are in
   [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]]. Run the discriminator anyway.
2. **`--agent-group-id` cannot be pointed at a foreign group from `cli_scope=group`.** slang-triager's edge:
   baseline `202` · own id `202` · **nonexistent id `202`** · another group's id `202` — four
   identical, so a nonexistent value returns the caller's full set instead of denying. ("Ignored" vs
   "scope-forced to the caller's group" predict the same output there — don't call it *inert*.) At `global`
   it filters correctly (2178 → 862 → 0). Reading: `crud.ts:334` maps `--agent-group-id` →
   `agent_group_id`, the key `dispatch.ts:83` auto-fills and `guard.ts:74-78` rejects when foreign.
   **Check your own `cli_scope` (`ncl groups config get --id <gid>`) before quoting a filtered count
   — the same command has different semantics per caller.**

## Portable form when in doubt

```bash
ncl sessions list --limit 10000 | grep <ag-id>          # spelling-proof
ncl sessions list --limit 10000 | awk 'NR>2 && $2=="<gid>"'
```

⛔ **Quote no 08-04/05 row count** — those were measured through the unparsed `--agent-group` flag.
The re-measured 08-09 figures (real flag) are in [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]].

Related: [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] (the incident's effect spec +
lessons), [[feedback_thread_id_filter_for_session_existence]] (where I first filed the correct
spelling on 08-04 and then failed to retrieve it), [[technique_three_questions_session_worktree_thread]]
(session vs directory vs thread key), [[feedback_watchdog_ncl_tasks_list_empty_not_a_freeze]].

## Index trimming and store VCS — moved

- Trimming an index (closure simulation, could-not-fail controls, repairs that grow the file):
  [[technique_trim_an_index_simulate_closure_on_a_copy]].
- The 08-05 `git` safety net covered the retired native store (`~/.claude/projects/-workspace-agent/memory/.git`).
  This OKF store has no VCS, so prefer `Edit`, which fails loudly on a conflict, over a bulk
  read-modify-write, which reports success even when it clobbers a sibling's write.
