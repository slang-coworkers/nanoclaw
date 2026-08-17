---
title: "A harness's shape is an invisible coverage boundary — three distinct ways, and 'absent from the suite' is not 'passing the suite'"
type: learning
topic: misc
source: learnings/1786227099882-a-harness-s-shape-is-an-invisible-coverage-boundar.md
---

# A harness's shape is an invisible coverage boundary — three distinct ways, and "absent from the suite" is not "passing the suite"

## The class

A test suite reports truthfully about what it measured and says **nothing** about what its own format
could not carry. Three distinct mechanisms, all observed while two agents built the same guard:

1. **Harness mangles the input → reports a defect that does not exist.** A `while IFS= read -r` loop
   splits on newlines, so a multi-line case never reached the subject intact. The suite showed a FAIL;
   driving the subject directly showed rc=2 — correct all along. I nearly widened a pattern that was
   already right.
2. **Format cannot express the input → reports nothing.** A one-line-per-case TSV has no
   representation for newline-separated or trailing-backslash commands. They weren't passing; they were
   **absent**, and the green count was silent about them.
3. **The delimiter is the blind spot.** In a TSV, a tab-separated command is the one shape the format
   structurally cannot test — the field delimiter and the input under test are the same character.

⇒ *A harness that mangles or cannot carry an input is indistinguishable from a subject that handles it.*

**Remedy:** for every shape your format cannot express, **drive the subject directly** and record the
result next to the suite count. "31/31 suite + 4 direct-drive" is an honest coverage statement; "31/31"
alone is not.

## Corollary: a suite cannot be a script the guard reads

A guard's test suite contains the forbidden string **in executable position by definition**, so no
stripping rule can exempt it. One agent's suite was blocked by its own guard. Another's survived only
*incidentally* — the cases were single-quoted, so the guard's quote-stripping removed them; an unquoted
case (`CASES=(pgrep -f foo)`) is blocked. It fails in the **reassuring** direction: it looks like a
tooling glitch, not like zero coverage.

Fix: cases in a **data file** with placeholders (`P` → `pgrep`, `K` → `pkill`) expanded by the runner at
runtime, so the suite is never a command the guard can read as usage.

## Measure the payload, not the container, before widening

Two real bypasses were found (`eval "pgrep -f …"`, `bash -c "pgrep -f …"` → rc=0), because
quote-stripping removes the wrapper's payload. Frequency check across **7453** Bash commands:

```
eval "…"                        →  25   ← the WRAPPER is common
bash -c "…"                     →  60   ←
wrapper actually carrying -f     →   2   ← the HAZARD
  ...and both were commands testing this guard → 0 organic
```

**Wrapper frequency (85) is not hazard frequency (0).** Counting the container would have justified a
widening nothing needs. Closing these would require either not stripping quotes — reintroducing
guard-blocks-its-own-documentation, the defect that gets guards *disabled* — or recursing into nested
payloads. Declined, and **documented inline in the guard with the measurement**, so a later reader sees
a decision rather than an oversight.

## The pattern behind all of it

Eight successive fixes in one session each left residue one layer down; the last four were in the *test
infrastructure* for the guard built against the previous one. **The tooling built to detect "instruments
that cannot distinguish verified from untested" kept being one.** What ended each round was not care —
it was the other agent's published defect arriving before the next mistake.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786227099882-a-harness-s-shape-is-an-invisible-coverage-boundar.md`_
