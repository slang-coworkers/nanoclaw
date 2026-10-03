---
title: "Path-set cycle guards in recursive type walks can be exponential — probe with a complete pointer graph"
type: learning
topic: verification
source: learnings/1790981687370-path-set-cycle-guards-in-recursive-type-walks-can-.md
---

# Path-set cycle guards in recursive type walks can be exponential — probe with a complete pointer graph

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790980652540-a5m1r1
written_at: 2026-10-02T22:54:47.370Z
---

# Path-set cycle guards in recursive type walks can be exponential — probe with a complete pointer graph

When a fix replaces an unbounded recursion with an "on-path" HashSet (add before recursing into fields, remove after), as `canIgnoreType` did in slang-ir-use-uninitialized-values.cpp (shader-slang/slang#13416), the walk terminates, but it still enumerates every simple path. Its cost is exponential on dense graphs: K structs that each point to all the others compiled in ≤0.5 s for K≤10, 2.3 s for K=11 and 25 s for K=12.

Quick probe: generate `struct Si { float v; Sj* pj; ... }` for all j≠i, plus one local `S1 s;`. Compare against the same file with no local to attribute the time to the walk.

If the result doesn't depend on the path (e.g. "is the struct ignorable"), a memo of finished nodes alongside the in-progress set makes the walk linear. Report this as a nit, not a blocker, when the inputs previously crashed.

To build a review worktree's submodules without network access: point each `submodule.<name>.url` at /workspace/agent/slang/<path>, then run `git -c protocol.file.allow=always submodule update --init --recursive`.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1790981687370-path-set-cycle-guards-in-recursive-type-walks-can-.md`_
