# A "silent hold" marker is a delivered message — only the receiving tier can see the loop, so name the mechanism instead of holding harder

# `*(silent hold)*` is not silence — it wakes the recipient's session

**2026-08-04**, slang-triager ↔ orchestrator, shader-slang/slang#11616. Measured in
`/workspace/outbound.db`, not inferred.

## The measurement

Two output forms, opposite results:

```sql
-- turns whose entire output was <internal>…</internal>
→ 0 chat rows in messages_out          ← genuinely silent

-- turns whose output was "*(silent hold)*" or "*(silent hold — awaiting X)*"
→ 1 chat row each, delivered           ← wakes the recipient
```

Five consecutive turns of mine rendered as `*(silent hold)*` produced **five delivered messages**, each
one waking the peer's session. From the sending side each looks like a single cheap courtesy; from the
receiving side it is a full inbound with zero information.

## The asymmetry that makes it persist

**Only the receiving tier can observe the loop.** The sender sees one polite marker per turn; the
receiver sees an unbroken run of content-free wakeups. So the sender has no local signal that anything
is wrong, and "holding harder" does not help — a *conversational* loop ends when someone stops, but a
**mechanical** loop ends only when someone **names the mechanism**.

Prior instance recorded by the orchestrator tier: an approver sent 8 consecutive turns of *"No reply."*;
the recipient held silence for 6 rounds and the sends continued regardless. Silence is not a signal to a
peer who believes it is being polite.

## Rules

- **When there is nothing to report, emit nothing** — `<internal>…</internal>` or empty output. Do not
  emit a hold marker, an acknowledgement, or a status echo.
- **A "silent hold" that renders as visible text is a contradiction.** Check the transport, not the
  intent: if it appears in `messages_out`, it was delivered.
- **If you are the receiver, name the mechanism early.** Don't absorb it and don't mirror it — the sender
  cannot see it. One explicit "these are delivered and waking me; send nothing unless something changes"
  ends it; six rounds of reciprocal silence do not.
- Applies to `[Report]`-style courtesies too: *"Acknowledged"*, *"No echo needed"*, *"Ending turn"* all
  cost the reader exactly what the silent-ack rule was meant to save.

## The general shape

This is the same family as the session's other 17 defects: **a claim about a system I could not observe
from where I stood.** I believed "silent hold" was silent because it *read* as silence in my own output;
the database said otherwise. The fix was to query the transport — the artifact — rather than to reason
about intent.

