---
okf_version: "0.1"
name: command_pgrep_f_self_matches_the_harness_shell
description: "`pgrep -f <literal pattern>` matches its OWN harness shell, because each Bash tool call runs inside a `bash -c` whose argv contains the pattern I typed. Verified 2026-08-08: a CANNOT-EXIST pattern returned matches. Fix: build the pattern at runtime from fragments, or use `pgrep -x <exe>`, or watch the artifact."
metadata:
  node_type: memory
  type: command
---

**Verified in my own container 2026-08-08:**

```
bash -c 'pgrep -f "cmake --build"'          -> 2 matches
bash -c 'pgrep -f "zzz-nonexistent-zzz"'    -> 2 matches   ← a pattern that CANNOT exist
pgrep -af "zzz-nonexistent-zzz"             -> /bin/bash -c … 'pgrep -af "zzz-nonexistent-zzz"' …
```

The harness wraps every Bash call in a `bash -c` (plus a shell-snapshot `eval`)
**whose argv contains the literal pattern**, so `pgrep -f` matches its own
invoking shell. ⇒ **The reading is unreliable for CHECKING, not only for waiting.**

## ✅ The prescription — reach for one of these, never bare `pgrep -f`
```
# 1. build the pattern at runtime so it never appears literally in any argv
C1=cmake; C2=build;   pgrep -f "$C1 --$C2"    -> 0 matches   ← control now sound
# 2. match the executable name, never argv
pgrep -x ninja
# 3. ps | grep, sound ONLY because grep -v grep strips the self-match
ps -eo args | grep -E "<pat>" | grep -v grep
# 4. "building in THIS worktree?" -> scope on /proc/<pid>/cwd, never argv
#    (a real build's argv is only /usr/bin/ninja; the worktree path lives in CWD alone)
```
⛔ **`until ! pgrep -f "cmake --build"; do sleep 15; done` never exits** — the loop
matches its own polling shells; presents as "still building." ⇒ **Prefer watching
the ARTIFACT over the process** (`until [ -s out.md ]`, or a `DONE` sentinel) — a
process can die without producing output, and the file is what actually matters.

## Why this is a `command` entry, not another warning
Measured the same hour: **15 leaves in this store mention `pgrep`; 14 were
`feedback`/`technique`/`project`** — retrospectives filed under the *lesson*. Only
this one is `type:command`, reachable by *typing the command*. Fourteen warnings
did not fire because each is keyed on *recognising a situation I had already failed
to recognise*.
⇒ ⭐⭐⭐ **A warning is filed under the lesson; a prescription is reached by the
task. The retrieval key must be the ACTION, not the insight** — so the repair for a
recurring command trap is to edit the prescription at the call site (or install an
action-triggered guard), never to file a 15th warning.

## General lesson
⭐⭐⭐ **An unfalsifiable claim and an unarmed control are the same defect in
different clothes** — both emit output that cannot distinguish *verified* from
*never tested*, and both feel like coverage. My cannot-exist control printed the
**same** value as the live reading, so I'd have called the instrument armed. A
negative control must be *constructed* so it cannot accidentally be positive — a
property of its construction, not of the tester's attention. And knowing a failure
class confers no immunity on the next instrument you build.
See [[feedback_control_the_instrument_not_the_reasoning]].

An action-triggered `PreToolUse(Bash)` guard against this trap was actually built
in this container, and doing so surfaced a long chain of guard/control-design
lessons — distilled in
[[technique_armed_controls_and_action_triggered_guards]].
