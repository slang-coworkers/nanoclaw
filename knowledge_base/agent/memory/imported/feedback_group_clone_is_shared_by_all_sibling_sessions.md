---
name: feedback_group_clone_is_shared_by_all_sibling_sessions
description: "A coworker's repo clone at /workspace/agent/<project>/ is PER-AGENT-GROUP, not per-session — 32 sessions share one tree. Destructive git ops there eat SIBLING sessions' uncommitted work (2 actors, 08-05); never chain one behind its own status check. ✅08-06: first POSITIVE case — read-then-leave saved a sibling probe. ⚠️And Main's same-named path is a DIFFERENT object: my clean status is no evidence about a peer's tree."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 9dea6606-e428-4cda-8d91-62c0e9a3aa35
---

# The group clone is shared by ALL sibling sessions — a `reset --hard` there is a fleet hazard

**Measured 2026-08-05:** `/workspace/agent/<project>/` is scoped to the **agent group**, not the
session. For `slang-triager` (`ag-1780667166418-apezq5`), **32 sessions share `/workspace/agent/slang/`**,
and any stopped-but-active session can be woken by the supervisor into that same tree.

⇒ ⭐⭐⭐ **The "other coworker" in a shared clone is usually ANOTHER INSTANCE OF YOU.** Before any
destructive git op, ask which sessions of *your own group* are live (`ncl sessions list`).

## Incidents (losses)

1. **08-05, slang-triager:** it ran `git status` and `fetch && checkout && reset --hard` **as one
   chained invocation**. The guard ("if dirty, STOP") was known and quoted, but the reset fired in the
   same breath and **3 tracked uncommitted files were destroyed**, unrecoverably. Its words: *"holding
   the rule didn't fire it because the command shape made the guard decorative."*
2. **08-05, slang-fixer:** `git reset --hard HEAD~1` while cleaning a probe commit destroyed **its
   own** edits twice. Same class, but a different mechanism (not a chained check).
3. **08-07, slang-triager again:** `git status --porcelain | … | wc -l` printed `1`, nothing consumed
   it, and `reset --hard` in the same command destroyed a sibling's `[ForceUnroll]` edit to
   `hlsl.meta.slang`. **The chained-guard mechanism now has 2 cases.**

⛔⭐⭐⭐ **A check and its consequent must be separable in time, or the check is ornament.** Never chain
a destructive op behind its own precondition (`status && reset`, `test && rm`). Run the check, read
it, then decide ([[feedback_control_the_instrument_not_the_reasoning]]).

⭐⭐⭐ **Where the fix must live:** on incident 3 the unsafe recipe was **still in the coworker's own
`CLAUDE.local.md`**: a copy-pasteable block ending in `reset --hard`, with the guard in prose three
lines below. I had escalated a spine-level guard, but a spine change can't reach a per-agent
`CLAUDE.local.md`. ⇒ **When fixing a dangerous default, list every layer that can supply it (spine /
per-agent instructions / memory / skills) and check each one.** A fix in flight at one layer doesn't
cover another. (My own `CLAUDE.md` and `CLAUDE.local.md` had 0 runnable destructive recipes, and I
know that only because I grepped.)

✅ **The peer's fix at the default:** a guard-first
`test "$(git status --porcelain | grep -v '^??' | wc -l)" -eq 0 || { echo ABORT; exit 1; }`, then
`git merge --ff-only origin/master` **instead of** `reset --hard`. It was proven in both directions
(ABORTs on the dirty tree, passes on a clean worktree). ⭐⭐ *An untested guard is the same defect one
layer up*, so the minimum is one must-fail and one must-pass observation.

## Discipline is not refuted — invocation is the gap

⛔ I first wrote "discipline is refuted as a barrier". **Retracted:** I had counted only the failures.
The peer's census found the caution **fired correctly in 8 distinct prior chains** (12330, 12361,
12384, 12392, 12393, 12394, 12406, infra-shared-worktree-collision), against 2 sibling-clobber losses.
⭐⭐ Publishing a negative verdict about a control is the same error as publishing a negative about a
capability: readers stop relying on it, and nothing logs that.

⭐⭐⭐ **The discriminator:** all 8 saves were **deliberate** cleanup/revert decisions, where stopping
to think *is* the task. Both sibling losses came from a **refresh recipe run as session boilerplate**.
⇒ **A destructive verb inside routine boilerplate never gets the deliberation the same verb gets when
it IS the decision.** The next audit target follows from that: any destructive op in a routine
recipe (refresh, cleanup, prune). The fixer's case is a partial exception, best explained by a
separate factor, **unsaved state at a routine step** ("commit before probing"). We considered a
unified rule ("deliberation only when the verb itself is the question") but didn't adopt it, because
it rests on one incident neither of us can inspect and the remedy is identical either way.

**Remedies (mechanical, preferred):** per-session git worktrees for write-capable chains;
`merge --ff-only` in place of `reset --hard` (it *cannot* silently discard); a guard wired into the
recipe at **every** layer that publishes one. Keeping probe artifacts in `scratch-*` outside the
clone is a real mitigation. Restore-from-`.pristine` is risky
([[feedback_a_recovery_copy_is_a_claim_not_an_authority]]).

## ✅ The positive case (08-06, slang#12392)

`slang-triager` found 5 tracked modifications it hadn't made, **read them first**, identified them as
a sibling's in-flight probe (`-- TRIAGE PROBE (revert me)`, diagnostic 38038), and **left them
alone**. It then showed **zero overlap** with every file its own findings depended on. ⭐⭐⭐ **That is
the shape to copy: READ the unexpected diff → IDENTIFY its author → decide, with no destructive op
anywhere in the sequence. A dirty shared tree doesn't invalidate your measurements; it obliges you to
show the dirt is disjoint from them.**

## ⚠️ Main's same-named path is a different object

At that moment my `/workspace/agent/slang` had the same `HEAD` (`d7d59f374`) but `git status` showed
**0** dirty lines. `findmnt -T /workspace/agent` settled it:

```
# slang-triager:  /dev/vdb [/prod-groups/slang-triager]
# Main (me):      /dev/vda1[/home/ubuntu/slang-coworkers-prod/nanoclaw/groups/main]
```

Different block device, different subpath: the two paths are namesakes, not two views of one tree.
⛔⭐⭐⭐ **One matching field (`HEAD`) is not proof of identity.** Two independent clones at one commit
agree by coincidence. Identity needs a field that can't agree by coincidence (a mount source, an
inode). ⇒ **A clean `git status` on my mount is no evidence about a peer's tree.** Run `findmnt -T`
on both ends before any cross-container file claim
([[feedback_identical_paths_hold_different_files_per_agent_group]]).

## What the ownership sweep could not establish

Sweeping all 235 sessions found no session that **reported** working on the 3 destroyed files.
`ncl sessions messages` returns the message transcript, **not the tool-call log**, and container logs
die with `--rm`. So the honest claim is *"no session reported working on them"*, never *"no session
was"* ([[feedback_name_what_your_instrument_cannot_record_before_enumerating]]).

Related: [[feedback_a_guard_can_be_inert_and_read_as_passing]] (the arming-failure family),
[[project_12298_enum_bool_switch_canonicalization]] (the chain incident 1 happened on),
[[project_slangpy_820_tagged_kernel_dispatch_segv]] (a shape invariant as an identity check).
