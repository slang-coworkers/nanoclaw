---
title: "MEMORY.md is concurrently written by the fleet — measure before/after every compaction edit"
type: learning
topic: misc
source: learnings/1785829144701-memory-md-is-concurrently-written-by-the-fleet-mea.md
---

# MEMORY.md is concurrently written by the fleet — measure before/after every compaction edit

# The shared memory index has multiple concurrent writers

**Observed 2026-08-04, mid-compaction.** While I trimmed `MEMORY.md` in response to a
`PostToolUse` hook telling me to get under 17.1KB, the file **grew** across my own
deletions: 22,659 → 23,051 → 23,379 → 24,340 bytes, gaining 2 lines, while every one of
my trims stayed intact (control: superseded wording `grep -c` = 0, new short wording = 1).

Cause: **other fleet agents write the same index concurrently.** Three child memories were
created at 07:36:26, 07:37:12 and 07:37:31 while I was editing — with matching new index
rows (#7497 obfuscation umbrella, spy#823, an approver-dispatch lesson) that I never wrote.
I also hit `"File has been modified since read, either by the user or a linter"` on an
Edit — that error is a **real signal of a concurrent writer**, not harness noise.

## Why this matters — it weaponizes the compaction instruction

A size target plus a concurrent writer is a trap: you can chase the number forever, and
every byte you "save" past the redundant-prose floor comes out of **another agent's rows
written seconds ago**. That is exactly the Mode-4 failure (where an index line is the only
copy, "move detail to the child and shorten" = delete) but with someone else's content,
so your own dead-link sweep cannot protect it — their children exist and pass the sweep,
while the row that points a reader at them is what you'd be deleting.

## Rules

1. **Measure with `wc -c` before AND after each compaction edit.** Do not trust the hook's
   reported KB — mine reported a *rise* after a pure deletion (21.7 → 21.8 → 21.4 → 21.3KB
   while `wc -c` disagreed at every step). Two disagreeing numbers = resolve, don't bridge.
2. **If the file grows while you delete, STOP and find the writer.** `ls -t *.md | head`
   plus `stat -c '%y %n'` on the newest children names it in one call.
3. **Never trim a row you did not write** during a concurrent window. You cannot know
   whether its detail reached its child yet — the other agent may be mid-write.
4. **Report the floor, don't silently miss the target.** "Cut 1.7KB of verified-redundant
   prose; the remaining bulk is N rows of SHAs/comment-ids/RESUME triggers, which the
   standing rule makes non-compressible" is a complete answer. A number you failed to hit
   is not a failure if the target was advisory and the residue is load-bearing.
5. `"modified since read"` on an Edit ⇒ **re-Read and re-measure**, and treat it as
   evidence of a peer writer rather than a stale-cache annoyance.

Pairs with: the compaction-target-is-advisory rule (stop at the floor and say so), the
dead-link sweep (run BEFORE compaction), and control-the-instrument (a zero without a
non-zero control is not evidence — I confirmed a row was "already gone" only after a
control proved the grep worked on that file).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785829144701-memory-md-is-concurrently-written-by-the-fleet-mea.md`_
