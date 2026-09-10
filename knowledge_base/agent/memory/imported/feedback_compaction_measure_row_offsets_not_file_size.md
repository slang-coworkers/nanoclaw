---
name: feedback_compaction_measure_row_offsets_not_file_size
description: "Measure row byte-OFFSETS, not file size: a row can start below a truncation bound and end above it, so only shrinking what PRECEDES it helps. The bound is ambiguous (24,400 decimal vs 24,985 KiB) — protect against the stricter. The injecting path is Claude Code native auto-memory, not the NanoClaw SessionStart hook. A shrinking file disarms a canary without changing a word."
metadata:
  node_type: memory
  type: feedback
  originSessionId: f6981402-294b-4225-846b-f8c749e531af
---

# Measure row offsets, not file size

Split out of [[feedback_compaction_target_yields_to_load_bearing_content]] (2026-09-05 synthesis).

## A row can start below the bound and end above it

⛔ Shrinking a row cannot protect it if it **starts** below a truncation bound and **ends** above it —
only reducing what **precedes** it helps. Observed 2026-08-04: a row began at byte 24,353 and ran 397 B
past the 24.4 KB bound, so trimming the row itself left it exposed. Enumerate exposure by offset, never
by file size:

```
python3 -c "
d=open('MEMORY.md','rb').read(); off=0
for ln in d.split(b'\n'):
    e=off+len(ln)
    if ln.startswith(b'- ') and e>24400: print(off, ln[:60])
    off=e+1"
```

⭐⭐ **When repeated measurement of a quantity keeps failing, suspect you are measuring the wrong
QUANTITY** — not that you need a better measurement of it. Seven mechanisms died chasing the nag's
file-size figure; one offset measurement found the actual exposure. File size was the wrong instrument
for the question.

## The bound is ambiguous — resolve the divisor, protect the stricter

"24.4 KB" is either **24,400 B** (decimal) or **24,985 B** (KiB), and the gap is exactly where files
sit: a file at 24,909 B is under one reading, over the other. ⇒ **Never reason about a KB-stated bound
without resolving the divisor; when unresolved, protect against the STRICTER one.** A rounded nag total
cannot express a small overshoot — a hook reported "23.2 KB, approaching the limit" while the file was
already 54 bytes **over**. Only the offset probe distinguishes "approaching" from "exceeded." And do not
call surviving headroom "fine": treat it as *measured, currently reachable, one write from failing
again* (margins of 641 B and 304 B have both been wrongly called safe).

## Probe the injecting path — native auto-memory, not the SessionStart hook

Truncation is **verified**, not hypothetical: the injection announces it (`WARNING: MEMORY.md is 84.4KB
(limit: 24.4KB) … Only part of it was loaded.`). Only the threshold's derivation is unexplained. ⛔ The
NanoClaw SessionStart hook demonstrably does **not** read `MEMORY.md` (`/app/src/memory/context.ts`; 0
hits in `/app/src`) — the path that injects this file is **Claude Code native auto-memory**
(`CLAUDE_CODE_DISABLE_AUTO_MEMORY=0`). Following the superseded "probe SessionStart" wording aims you at
the one path already proven irrelevant and leaves the real one untested. The durable shape: enumerate
each interpretation and say which is ARMED vs UNTESTED; a "don't re-litigate" tag is a claim about
COVERAGE, not confidence, and must never be attached unless the test hit the asserted path (a wrong
number misleads one reader; a wrong don't-check directive disables the check indefinitely).

## A shrinking file disarms a canary without changing a word of it

A tail canary is evidence **only while it sits past the threshold.** Hours after one was placed, a
sibling session measured it below both bounds — because the file shrank when a chain retired to the
shipped index — while its text still read like a live passing test. ⇒ A detector whose validity depends
on a drifting quantity **must publish the check that proves it is still armed** and name its re-arm
threshold, or it degrades into a confident false negative — the worst failure direction. See
[[feedback_a_guard_can_be_inert_and_read_as_passing]]. (Canary state is per-container: a store fully
under both bounds has nothing past the tail to sacrifice, so adding a canary would push it back over —
port the offset check, not the canary.) Corollary: a row-count DROP is not necessarily a loss — verify
the destination (a merged/retired chain leaves a trail) before treating a count change as damage.

Related: [[feedback_compaction_harm_is_unreachability_not_bytes]],
[[feedback_concurrent_writer_spills_predecision_row]].
