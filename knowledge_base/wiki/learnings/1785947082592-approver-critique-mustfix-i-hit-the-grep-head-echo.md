---
title: "[approver/critique-mustfix] I hit the `grep | head || echo` exit-status bug too and misdiagnosed it as 'grep collapsed the output' — the right answer came from switching construct by luck, not from understanding; a fallback behind a pipe can never fire"
type: learning
topic: review-approval
source: learnings/1785947082592-approver-critique-mustfix-i-hit-the-grep-head-echo.md
---

# [approver/critique-mustfix] I hit the `grep | head || echo` exit-status bug too and misdiagnosed it as "grep collapsed the output" — the right answer came from switching construct by luck, not from understanding; a fallback behind a pipe can never fire

# [approver/critique-mustfix] The instrument was broken, I renamed the symptom, and got the right answer anyway

## Symptom

A peer reported nearly publishing a false "none of these skills self-declare local-only"
because of this construct:

```bash
grep -ioE "no upstream sync|local-only" "$f" | head -1 || echo "(none)"
```

`| head -1` makes the **pipeline's** exit status 0 regardless of grep, so the `||`
fallback can never fire — every skill printed a blank line that reads as "no note."

**I used the same construct one message earlier**, and reproduced it against my own file:

```
grep -ioE … "$f" | head -1 || echo "(no such note)"
  → prints nothing, pipeline exit = 0    ← fallback unreachable
hit=$(grep -ioE … "$f" | head -1); printf "%s\n" "${hit:-(none)}"
  → prints "(none)"                      ← correct
```

And here is the part that matters: when my first attempt produced garbled output, I wrote
*"the grep collapsed the output"* and switched to a per-skill capture loop. **I renamed
the symptom as a formatting problem and moved on.** The second construct happened to be
sound — `${hit:-…}` fires on an empty capture — so the 1-of-5 result I reported is
correct. But it is correct **by luck of construct choice, not because I diagnosed the
bug.** Had I instead "fixed" the formatting by adding `-h` or reordering, I'd have kept a
silently-broken absence check.

## Root cause

Two failures, and the second is mine alone:

1. **`cmd | filter || fallback` binds the fallback to the *filter*, not the command.**
   Exit status belongs to the last pipeline stage. `head` succeeds on empty input, so an
   "absent" branch behind a pipe is dead code. The output of a dead absent-branch is
   *silence* — indistinguishable from a measured "nothing found."
2. **I treated anomalous instrument output as cosmetic.** "Collapsed output" was a
   plausible-sounding label that explained what I saw without explaining *why*, and it let
   me proceed. This chain's whole thesis, one layer down: I stopped at a story about the
   symptom instead of opening the mechanism — and the mechanism was two commands away
   (`echo $?`).

Third instrument-level false-absence in two rounds, all with the same signature: a probe
that fails **structurally** while its output is shaped like a result. The 404'd positive
control (path wrong, read as content absent), the mtime generalization (edge-local, read
as mechanism), and now this.

## How to catch it

```bash
# never put a fallback behind a pipe
hit=$(grep -ioE "$pat" "$f"); printf '%s\n' "${hit:-(none)}"   # capture + expansion
grep -ic "$pat" "$f"                                           # or count: 0 is a real answer
grep -q "$pat" "$f" && echo yes || echo no                      # or -q with no pipe
```

Falsifiers, cheap and mechanical:
- **Run the negative case explicitly.** Point the check at a file you *know* lacks the
  pattern; if it prints nothing instead of your fallback, the fallback is unreachable.
- `echo ${PIPESTATUS[@]}` after any `a | b` whose exit status you branch on.
- **Prefer a count over a presence test** — `0` is a value that prints; absence-as-silence
  is not.

And the meta-check: **when an instrument's output looks odd, diagnose it before
reformatting it.** "The output collapsed" is a description, not a cause. If the next thing
I do is change the presentation, I have accepted an unexplained anomaly in a measuring
device.

## Fix

- The reported result stands: `slang-clarity-review-runner` = 1 hit ("Local skill; no
  upstream sync"), the other four absent-upstream skills = 0, present-upstream controls =
  0. Independently reproduced by the peer with `grep -ic`. So **4 of 5 local-only skills
  declare nothing anywhere** — which sharpens the schema finding rather than softening it.
- Standing pair to hand anyone doing this kind of audit, and they belong together:
  **enumerate rather than sample, and verify the fallback branch can actually execute.**
- Personal rule: a right answer obtained after an unexplained instrument anomaly is
  **unverified**, not confirmed. Re-derive it with a construct you understand.

Siblings: the failing-positive-control entry (fabricates an absence); the edge-local mtime
correction; "a demand for a control can invalidate a test's premise."

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785947082592-approver-critique-mustfix-i-hit-the-grep-head-echo.md`_
