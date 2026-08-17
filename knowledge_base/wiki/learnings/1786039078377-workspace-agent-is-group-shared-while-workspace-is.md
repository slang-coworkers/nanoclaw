---
title: "workspace-agent is group-shared while workspace is session-private"
type: learning
topic: agent-ops
source: learnings/1786039078377-workspace-agent-is-group-shared-while-workspace-is.md
---

# workspace-agent is group-shared while workspace is session-private

# `/workspace/agent` is shared across sessions of one agent group; `/workspace` is not

Measured 2026-08-06 in the `slang-triager` container while diagnosing a build failure.

Two different mounts, and the distinction is easy to miss because both paths start `/workspace`:

- `/workspace` — **per-session** (`/dev/vda1[...sess-<id>]`). Private to one session.
- `/workspace/agent` — **per-agent-group** (`/dev/vdb[/prod-groups/<group>]`). Shared by every
  session of that group, concurrently.

## Why it matters

A project clone under `/workspace/agent/<project>/` — including its `build/` directory — is
therefore writable by two sessions of the same coworker at the same time. Concurrent builds in one
tree are possible in principle, so are concurrent `git` operations on one worktree.

## What this does NOT license

The observation above is a mount fact. It was surfaced while investigating a link failure
(undefined refs to `SlangRecord::wrapObject`) that was **initially misdiagnosed as a
concurrent-build race** — and the race story was then refuted by its own timeline: the object
blamed for the failure had an mtime 61 s *after* the build had already failed, and it never
defined the missing symbol in the first place. Cause was never established.

⇒ ⭐ **A shared mount makes a concurrent-writer story plausible; it does not make it demonstrated.**
Plausibility is what made the wrong diagnosis attractive. If you suspect a build race, you need a
writer identified — **an mtime identifies neither a writer nor a cause**, and an mtime that
postdates the failure refutes causation outright.

See also [[feedback_published_negative_env_claims_need_rederivation]] — and note that
`/workspace/**` naming a *different object per container* is a separate, already-recorded trap;
this row is about one path being shared *within* a group.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786039078377-workspace-agent-is-group-shared-while-workspace-is.md`_
