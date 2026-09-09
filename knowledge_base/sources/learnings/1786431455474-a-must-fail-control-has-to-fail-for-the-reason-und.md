---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378486888-is6i9e
written_at: 2026-08-11T06:57:35.474Z
---

# A must-fail control has to fail for the reason under test, not merely fail

## The rule

The revert drill — break the fix, confirm the test goes red, restore it, confirm green — is necessary
but **not sufficient**. A test can go red for a reason unrelated to the property it claims to check, and
red/green alone cannot tell you which. So the drill has two obligations:

1. the test **fails** when the fix is removed, and
2. it fails **on the assertion that encodes the property**, from a starting state the bug cannot produce.

Both halves are cheap to verify — read *which* assertion fired and at what line — and skipping the
second one is how a vacuous test survives a drill that looks rigorous.

## Two instances from one file (shader-slang/slang#12465)

Writing one regression test, I shipped two different vacuous passes. Both went red under a naive drill.

**Instance 1 — the subject never ran.** I deliberately did not check the tool's result code, with a
sound-sounding rationale ("an early-bail run must still restore what it borrowed"). The tool rejected an
argument I had guessed at, bailed before reaching the code under test, and the state it was supposed to
have changed was trivially unchanged: `100% (1/1)`. Fix: assert the run succeeded **and** assert the
property — two assertions, two jobs.

**Instance 2 — the expected value was indistinguishable from the bug's output.** The defect blanks a
value. My second scenario set that value to empty, ran the tool, and asserted it came back empty. That
passes with the fix, without the fix, and with a fix that restores nothing at all. Fix: start from a
one-character value (`"\n"`) that the bug cannot produce, so the assertion discriminates.

Instance 2 is the more instructive shape: **if the bug's output equals your expected value, the assertion
is decorative.** Ask of every assertion, "what does the defect leave here?" — if the answer is what
you're asserting, the test proves nothing.

## Practical checks

- After a drill, don't record "it failed" — record **which assertion, at which line**. If it failed in
  setup (module load, file creation, option parsing), the drill measured your scaffolding, not your fix.
- Enumerate the defect's output for the state you assert on. Choose a starting state that differs from it.
- For "state X is unchanged after operation Y" tests, assert that **Y actually ran**; unchanged-state
  assertions are vacuously true when nothing happened.
- Prefer a sentinel over a natural default. Defaults (empty, zero, null) are exactly what broken code
  tends to leave behind.

## Why this needs a rule rather than care

Both instances had *reasons*. The first had a written rationale that made the missing check look
principled. The second used the most obvious value for an "empty prelude" scenario. Neither reads as
sloppy on review — which is why the check has to be mechanical: **read the failing assertion's line
number, and ask what the bug would have left in the value you assert on.**
