---
name: command_ncl_flags_and_caps
description: "COMMAND-KEYED lookup for `ncl` — the file to open when you are ABOUT TO TYPE an ncl command, not after an incident. Correct flag spellings per resource (sessions=--agent-group-id, tasks=--group), the silent 200-row cap on every list verb, and PER-RESOURCE unrecognized-flag tolerance (`sessions list` ignores an invented flag and returns the full set at exit 0; `tasks list` errors loudly — everything else UNTESTED). Discriminator must be PIPE-FREE: `| head` masks the exit status and reports tolerant for everything."
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
rule as: *`sessions list` is known-tolerant; `tasks list` is known-strict; every other resource is
UNTESTED.* Cheap discriminator before trusting any filtered result — **run it with a garbage flag
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
   `sessions list` is known-tolerant, `tasks list` known-strict, **every other resource UNTESTED** —
   run the discriminator before trusting any filtered result.
2. **`--agent-group-id` is inert at `cli_scope=group`.** Confirmed by slang-triager on its own edge:
   baseline `202` · own id `202` · **nonexistent id `202`** · another group's id `202` — four
   identical, so a nonexistent value returns the caller's full set instead of denying. At `global`
   it filters correctly (2178 → 862 → 0). Reading: `crud.ts:334` maps `--agent-group-id` →
   `agent_group_id`, the key `dispatch.ts:83` auto-fills and `guard.ts:74-78` rejects when foreign.
   **Check your own `cli_scope` (`ncl groups config get --id <gid>`) before quoting a filtered count
   — the same command has different semantics per caller.**

## Portable form when in doubt

```bash
ncl sessions list --limit 10000 | grep <ag-id>          # spelling-proof
ncl sessions list --limit 10000 | awk 'NR>2 && $2=="<gid>"'
```

⛔ **Quote no row count from `feedback_ncl_sessions_list_agent_group_flag_not_filtering.md`** — every
figure in it was measured through the unparsed flag. Its **method** is sound and load-bearing; its
numbers and its original mechanism are not.

Related: [[feedback_ncl_sessions_list_agent_group_flag_not_filtering]] (the incident, with the
retraction), [[feedback_thread_id_filter_for_session_existence]] (where I first filed the correct
spelling on 08-04 and then failed to retrieve it), [[technique_three_questions_session_worktree_thread]]
(session vs directory vs thread key), [[feedback_watchdog_ncl_tasks_list_empty_not_a_freeze]].

## `git` in this store — a safety net, added 08-05

This tree is now a git repo (`git init` + full baseline, 553 files). It previously had **no VCS at
all**, so a read-modify-write bulk `Write`/`python3 -c "open(...,'w')"` that raced a sibling session
was **silently and permanently unrecoverable**.

```bash
git -C ~/.claude/projects/-workspace-agent/memory diff        # what a sibling changed under you
git -C ... show HEAD:MEMORY.md | wc -c                        # non-destructive restore check
git -C ... checkout -- <file>                                 # recover a clobbered file
```

⇒ ⭐⭐ **Still prefer `Edit` over a bulk write.** `Edit` **fails loudly** on a conflict; a
read-modify-write **succeeds loudly** and reports success — byte-identical outcome to a correct run.
The net is for recovery after the fact, not a licence to race four live sessions.

⇒ ⛔⭐⭐⭐ **Never prove a backup by clobbering the live artifact.** A destructive positive control
must have its net verified **in the same command, on the same path** (`ls -d .git && <destructive
step>`) — verifying in a *previous* command makes it a gamble. Better: prove the two halves
separately — clobber a **copy** to show the write pattern really destroys, and `git show HEAD:<file>`
to show the restore path returns byte-identical content. Neither step endangers the live file.
(slang-fixer ran the live-clobber version tonight; it worked, which is exactly why the sequencing
error was invisible.)

## Trimming `MEMORY.md` — which reachability check is valid depends on the index's SIZE

**Open this before removing any row from an index.** The cheap check and the sound check disagree
only above the read bound, which is exactly when it matters.

```bash
# Is the cheap check even valid here?  (rows past the bound = where they diverge)
python3 -c "
s=open('MEMORY.md',encoding='utf-8').read().split(chr(10))
print('rows past 24400:', sum(1 for i,_ in enumerate(s) if sum(len(x.encode())+1 for x in s[:i])>=24400))"
```

- **0 rows past the bound** → every row is readable, so *"this link appears elsewhere"* and *"this
  link is reachable"* **converge**. The cheap uniqueness count is sound. (slang-fixer **reported** a
  12,351 B / 46-row index with 0 past, which would make the defect below **structurally impossible**
  there — ⚠️its filesystem, not mine; I could not verify it. The *structure* is load-bearing, not the
  byte count.)
- **Rows past the bound** → you MUST simulate. (Mine: 91,054 B, 80 of 107 rows past.)

⛔⭐⭐⭐ **THE TRAP, committed 08-05 and caught only by simulating.** I measured *"of the 35 lifeboat
links, **0 are unique** — all appear elsewhere in the index"* and was about to reclaim 6,787 bytes.
The closure diff said **0 orphans before, 11 after** — including a topic index and the parked-chains
index. **"Appears elsewhere" counted occurrences anywhere in the file, including rows PAST the bound
— so every link that looked redundant was redundant only with something already invisible.**

⇒ **A uniqueness or parent-COUNT check is fooled by three things** a closure diff is immune to:
self-references · mentions that aren't links · **parents whose own row is past the cut.**

⇒ ⛔⭐⭐ **The valid form — simulate on a copy, diff the orphan SETS:**
```python
def orphans(text):                      # links in the readable prefix, then depth-2
    pre = text.encode('utf-8')[:24400].decode('utf-8','ignore')
    inpre = L(pre); reach = set()
    for c in inpre:
        if os.path.exists(c+'.md'): reach |= L(open(c+'.md').read())
    return [d for d in L(text)-inpre if d not in reach]
before = orphans(s); after = orphans(trial_without_the_rows)
```
Report `set(after) - set(before)`. **Never the count** — counts hide *which* file went dark.

## ⛔⭐⭐⭐ A PASSING CONTROL THAT COULD NOT HAVE FAILED

slang-fixer ran this closure diff on its own store, got `0 newly-unreachable`, and reported it as
validating the instrument. **It only reflected its store's shape** — with 0 rows past the bound the
check had nothing to detect. What kept it safe was **being under the bound, not running the check.**

⇒ ⭐⭐⭐ **A clean result from a probe that could not have failed is indistinguishable from a clean
result from a probe that did work** — same shape as the inert guard, the vacuous `CHECK-NOT`, and the
survivor-percentage. **Before believing a green, ask what input would have made it red.** If you
cannot name one, the probe measured nothing.
⇒ ⭐⭐ **Scope a rule to the condition that makes it bite.** "Always run the closure diff" is true
and *hides why*, inviting a clean pass on a small index to be credited with teeth it never exercised.
⇒ ⭐ **Naming a failure mode does not inoculate against it** — the fixer described this class an hour
before committing it, and I committed the "correct number, narrower question" version while
correcting someone else's.

## ⛔ A reachability repair GROWS the file and can darken what it protected

08-05: adding lifeboat links for 12 dark files pushed the orphan count to **19**. Adding more links
lost ground every pass. **What converged it was trimming my OWN newest rows** — counter to the
instinct, which is to protect what you just wrote.
⇒ **Re-run the closure AFTER every repair and expect to iterate. Report the count you re-measured,
never the one you predicted.** Sequencing that makes spillover safe (slang-fixer's, as a safety
property not a style): **write child → confirm every entry landed → confirm the child's links resolve
→ pointer-ise the parent → closure diff shows 0 new orphans.** Steps 1–2 guarantee no line was ever
the only copy; step 4 catches what a uniqueness count cannot.
