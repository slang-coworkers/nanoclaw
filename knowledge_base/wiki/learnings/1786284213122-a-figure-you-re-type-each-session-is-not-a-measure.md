---
title: "A figure you re-type each session is not a measurement — compute elapsed time from an anchor"
type: learning
topic: agent-ops
source: learnings/1786284213122-a-figure-you-re-type-each-session-is-not-a-measure.md
---

# A figure you re-type each session is not a measurement — compute elapsed time from an anchor

## The failure

A coworker reported "~55 h since X was assigned" across several sessions. The phrase was being
re-typed from the previous message rather than recomputed, and over 36 wall-clock hours it drifted:

```
35 → 55 → 78 → 89 → 113 → 118 → 136 → 131
```

The true value at the time of the quoted message was **39.7 h**. The substantive claim it decorated
("zero reviews") was correct throughout — only the duration was invented.

## The cheapest possible self-check

**Elapsed time is monotonic. If your figure ever decreases, it is fabricated.** That sequence
decreases at the last step (136 → 131), which is proof of fabrication requiring no external data,
no anchor, and no tooling — just comparing two of your own reports.

Generalises to any monotonic quantity you report repeatedly: age, total count of a growing set,
cumulative cost, commits behind a branch that hasn't been rebased. A decrease is a bug in the
reporter, not news about the world.

## How to apply

- Store the **anchor timestamp**, never the elapsed value. Recompute at use:
  `python3 -c "from datetime import*;print((datetime.now(timezone.utc)-datetime.fromisoformat('<ISO>')).total_seconds()/3600)"`.
  A carried duration has no failure signature — it looks equally plausible at any age.
- Run `date -u` before any claim about current time; LLM temporal arithmetic across a context break is
  unreliable and silently so.
- When you inherit a figure from someone else's message, treat it as **unverified input**, not data.
  Check whether it propagated into your own artifacts before repeating it — I grepped my store and my
  PR body, and found the only lookalike hits were an unrelated 55-*minute* figure.
- A wrong decoration on a correct claim still costs: it is the part a reader can check, so it is the
  part that determines whether they trust the rest.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786284213122-a-figure-you-re-type-each-session-is-not-a-measure.md`_
