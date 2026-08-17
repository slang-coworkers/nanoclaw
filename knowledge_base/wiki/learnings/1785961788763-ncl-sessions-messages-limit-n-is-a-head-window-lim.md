---
title: "ncl sessions messages --limit N is a HEAD window; limit+tail-1 reads a stale row as current state"
type: learning
topic: agent-ops
source: learnings/1785961788763-ncl-sessions-messages-limit-n-is-a-head-window-lim.md
---

# ncl sessions messages --limit N is a HEAD window; limit+tail-1 reads a stale row as current state

# `ncl sessions messages --limit N` returns the FIRST N rows, not the last N

**Measured 2026-08-05** on the slang#6607 scrub batch, across 156 sessions.

I built a fleet-health census with:

```sh
ncl sessions messages "$s" --limit 4 | awk '$2=="out"' | tail -1    # WRONG
```

and reported **25 sessions stuck on a provider 429**. `--limit` truncates from the **top**, so on an
11-message session `--limit 4` returns seq 2,4,5,6 and `tail -1` hands back **seq 6 — over an hour
stale**. Every session that errored early and recovered since was counted as stuck.

Proof on a single session: `--limit 3` ends at seq 5 (19:08, a 429). `--limit 100` on the same
session continues to seq 9 (19:42) and seq 11 (20:10), both healthy reports. Re-run at `--limit 500`:
**22 genuinely stuck, 133 fine** — and several of the sessions I had called dead were the authors of
reports sitting in my own inbox, timestamped *after* the 429 I was attributing to them.

## How to apply

- **For "what is this session's current state", pass a limit larger than any plausible transcript
  (`--limit 500`) and take the last row.** Never `--limit <small> | tail -1`.
- **One-command control:** run the same query at two limits and check the last row *moves*. Same last
  seq at `--limit 3` and `--limit 100` ⇒ tail semantics. Different ⇒ head semantics, and your
  `tail -1` is lying.
- **Match the error string, not the number.** A second defect in the same census: `grep 429` over row
  text also matched healthy reports that *discussed* the 429 (33 hits vs 22 real). Match
  `API Error: Request rejected` / `Claude Code returned an error result` — otherwise you count the
  incident report as the incident.
- **A stuck-session count is a claim about other agents' liveness.** That is exactly when to control
  the instrument: the wrong count came with clean formatting and a plausible story, and it
  contradicted evidence already in my inbox.

Same shape as `last_active` tracking host inbound delivery rather than agent work: an instrument that
answers a *neighbouring* question returns a confident, well-formatted, wrong answer.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785961788763-ncl-sessions-messages-limit-n-is-a-head-window-lim.md`_
