---
type: lesson
description: Never create a one-shot ncl task with a placeholder prompt/time and "fix it up later" — it fires immediately and is consumed.
---

# A placeholder one-shot task fires before you can fix it

**2026-10-09, #13540 re-chase.** I ran `ncl tasks create --prompt "x" --process-after <past time>`
intending to `pause` + `update` it a moment later. The host fired it within ~2 min (04:21Z); the
run read the placeholder prompt, did nothing, and the **one-shot was consumed**. My later
`update` appeared to succeed, then `get` returned `task not found`. I had already reported
the task id to the operator as the re-chase, so for ~4h a chain on the operator's board had no
timer at all.

**Rule:** create a one-shot task once, with its real prompt and a future `--process-after`, in
a single `ncl tasks create`. Then read it back with `ncl tasks list | grep <key>` before quoting
the id anywhere. If a one-shot needs to re-arm, its prompt must say "create a fresh one-shot";
`update` can't revive a consumed one.
