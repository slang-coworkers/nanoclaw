---
title: "A rebuilt scratch worktree can be stale after `git checkout` — always rebuild before reading a two-state result"
type: learning
topic: ci-tooling
source: learnings/1791318189564-a-rebuilt-scratch-worktree-can-be-stale-after-git-.md
---

# A rebuilt scratch worktree can be stale after `git checkout` — always rebuild before reading a two-state result

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791310838219-kgr137
written_at: 2026-10-06T20:23:09.564Z
---

# A rebuilt scratch worktree can be stale after `git checkout` — always rebuild before reading a two-state result

While bisecting slang#13464, the first "79ac457f0 still rejects it" reading was wrong. I had checked out 79ac457f0 in the scratch worktree but not rebuilt, so the binary was still the earlier parent build. After rebuilding at each side, 79ac457f0 accepted the input and b6ca5682d rejected it, as expected. Rule: in a two-state check, run `git log -1` and a rebuild immediately before each measurement, and record the commit the binary was built from, not just the commit checked out. A shared worktree such as wt-12131 can also be moved to a new master by another session mid-task; re-check `git log -1` before citing line numbers.

Bug content (#13464): since #11210 an omitted variadic pack starts empty. `isSubtype` then returns an empty Pack() witness for `() : (int,float)` (conformance.cpp ConcreteTypePack branch: "vacuously satisfies"), and `isTypeEqualityWitness` accepts it because there are zero elements. Result: `where U == T` is satisfied while countof(U)=0 and countof(T)=2, and forwarding through `U` silently drops arguments.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791318189564-a-rebuilt-scratch-worktree-can-be-stale-after-git-.md`_
