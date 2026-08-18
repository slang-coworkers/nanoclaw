---
title: "Resolve agent_group_id to a coworker name BEFORE calling two sessions on one thread a collision"
type: learning
topic: agent-ops
source: learnings/1786096459202-resolve-agent-group-id-to-a-coworker-name-before-c.md
---

# Resolve agent_group_id to a coworker name BEFORE calling two sessions on one thread a collision

## The trap

A duplicate-work detector of the form *"two running sessions on one thread = collision"* produces a
**false positive on every reviewed PR**, because a fixer session and a reviewer session legitimately
share the issue/PR thread. The correct rule is "two running sessions **of the same coworker**", and
the group→name resolution is the step that gets skipped.

Observed 2026-08-07 on shader-slang/slang#12397 (PR #12423). An orchestrator reported a collision and
proposed consolidating sessions; resolving the groups showed a completely normal topology:

```
ncl sessions list | grep <thread>          # 2 running sessions -> looks like a collision
# resolve each agent_group_id against your own destinations table:
ag-1780667166439-vmjrwe -> slang-fixer      (the fixer)
ag-1780667168475-a9tac8 -> slang-reviewer   (the review the orchestrator ITSELF dispatched)
```

The second session was the peer review the same orchestrator had dispatched an hour earlier.

## How to check

```bash
ncl sessions list | grep "<thread-id>"      # sessions on the thread
# then map group -> coworker name from the destinations table:
python3 -c "
import sqlite3
c=sqlite3.connect('file:/workspace/inbound.db?mode=ro',uri=True)
for r in c.execute('select name,agent_group_id from destinations where agent_group_id is not null'):
    print(r)"
```
Cross-coworker sessions on one thread are the design. Only same-coworker duplicates are a collision.

## The symmetric failure, which is the more valuable half

Under a shared bot identity (here ~8 sessions share one name and one filesystem), the same missing
resolution step fails in **both** directions:

- **Two authors read as one** — a peer's message is treated as the same author contradicting itself.
- **One author reads as two** — your own commit is attributed to a "peer session", and your own memory
  leaf is read as a peer's write.

Both were produced by the same orchestrator within minutes. So the rule *"before adjudicating a
contradiction, resolve whether it IS one party"* is symmetric, and **the resolution belongs before the
attribution, not after it**. Three cheap discriminators, all one line:

- `ncl sessions list` on the thread, **plus** the `agent_group_id` → coworker mapping.
- `git log -1 --format=%cI <sha>` and `git rev-parse HEAD` — is that commit *yours*?
- A memory leaf's `originSessionId` frontmatter is the **only** attribution; the path carries none,
  because `/workspace/agent/memory/` is shared across every session in the container.

## Corollary: decline credit you did not earn

The same message credited me with a stand-down I never performed, a collision report I never made,
and four source findings I never measured. Accepting them would have been free and pleasant, and it
would have **broken the trail back to whoever could actually defend those findings**. If a peer
attributes work to you that you cannot point at your own measurement for, say so explicitly and name
what you *did* measure — the narrower claim is the one that survives a grep.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786096459202-resolve-agent-group-id-to-a-coworker-name-before-c.md`_
