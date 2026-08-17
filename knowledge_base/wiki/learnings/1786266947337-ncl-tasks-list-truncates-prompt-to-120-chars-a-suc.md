---
title: "ncl tasks list truncates prompt to 120 chars — a successful write reads back as a failed one"
type: learning
topic: agent-ops
source: learnings/1786266947337-ncl-tasks-list-truncates-prompt-to-120-chars-a-suc.md
---

# ncl tasks list truncates prompt to 120 chars — a successful write reads back as a failed one

# `ncl tasks list` truncates `prompt` to 120 chars — so a SUCCESSFUL write reads back as a FAILED one

## Rule

**When a write reports success and your read-back contradicts it, suspect the READ first.** Verify with a
different verb before believing the write failed — and before "repairing" it.

Concretely for scheduled tasks: `ncl tasks list --json` truncates the `prompt` field to **120 characters**
and appends `...`. Use **`ncl tasks get <series-id> --json`** to read a prompt you just wrote.

## Why — measured 2026-08-09

Updating a recurring task's prompt (4081 chars in, via `ncl tasks update --id <series> --prompt "$(cat f)"`):

- the write returned `{"touched": 1, "fields": ["prompt"]}`
- verify via `ncl tasks list --json` → `prompt len: 120`, and **every** content probe `False`
  (`'--limit 6000' in p` → False, etc.)
- verify via `ncl tasks get <series-id> --json` → `prompt len: 4062`, **all probes True**

The write was correct the whole time. The list view **manufactured evidence that a correct write had
failed**, and the two obvious next moves — re-issue the write, or shorten the prompt to "fit" — would both
have been damage done in response to an instrument artifact.

The tell was in the output all along: the value ended in `...` at a suspiciously round **120**. A round
number plus an ellipsis is a display limit, not a datum.

## Family — this is the THIRD truncating instrument in the same CLI

| verb | silent limit | false result it produces |
|---|---|---|
| `ncl sessions messages` | 300 chars/message without `--full` | incident greps return a false **0** (a pattern matching mid-message never fires) |
| `ncl sessions list` | caps at exactly **2000** rows (`--limit 2000` → 2002 lines; `4000`/`6000` → 2506) | sessions read as **absent**; per-group counts under-report |
| `ncl tasks list` | **120** chars of `prompt` | a landed write reads as never-applied |

Cheapest detectors, in order of cost:
1. **Does the value end in `...`?** Free.
2. **Is the length a round number** (120 / 300 / 2000)? Free.
3. **Raise the limit and see whether the number moves.** One extra call.
4. **Re-read with a different verb** (`get` instead of `list`). One extra call.

## The general shape

A tool that silently collapses output — cap, truncation, dedup, window — returns a **true number about a
set you never saw**. The dangerous direction is not "it hid something from me": it is that the collapsed
view is *indistinguishable from a real negative*, so it licenses corrective action against a system that
was fine. Prefer a check whose **failure** is distinguishable from its **negative result**.

Corollary worth stating separately: **a source that cannot testify is not a negative result.** In the same
session, "no operator reply on either dashboard group" was half vacuous — one of the two groups had **zero
sessions**, so it could only ever return 0. Scanning it was a null instrument dressed as evidence. Say
which of your negatives had a live instrument, and report the control count (rows actually examined)
alongside any zero.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786266947337-ncl-tasks-list-truncates-prompt-to-120-chars-a-suc.md`_
