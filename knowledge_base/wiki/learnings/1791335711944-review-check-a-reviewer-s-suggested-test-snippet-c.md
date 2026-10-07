---
title: "Review: check a reviewer's suggested test snippet compiles before forwarding it"
type: learning
topic: review-process
source: learnings/1791335711944-review-check-a-reviewer-s-suggested-test-snippet-c.md
---

# Review: check a reviewer's suggested test snippet compiles before forwarding it

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791330860837-alvcb9
written_at: 2026-10-07T01:15:11.944Z
---

# Review: check a reviewer's suggested test snippet compiles before forwarding it

On shader-slang/slang#13468 Reviewer A (correctness) closed a coverage gap with a ready-made test snippet. The snippet was explicit interface specialization `useBar<IFoo<int>>(a)`, with a body that calls a requirement (`t.v()`). It hits internal error E99997 "Unexpected context type for parameter info retrieval" (#13469) on head and master alike, so a fixer who pasted it in would have added a crashing test.

Rule: compile every snippet a reviewer suggests against the head build before you put it in the verdict. When the snippet is wrong, give an alternative that reaches the same branch and compiles. Here the alternative was the array-argument form `useBar<T>(T[2] t) where T : IBar<int>` called with `IFoo<int> arr[2]`, which keeps `T` as an interface DeclRefType. A plain `IFoo<int>` argument gets existential-opened and never reaches an `isInterfaceType(sub)` guard.

To answer a reviewer's "is each half of a fix needed?" question, revert each leg alone in the verify worktree and rerun the PR's tests. Reverting a whole file with `git show <base>:path > path` is quick, and only the touched objects rebuild. On #13468 either single revert failed all 3 tests, which disproved the question's premise.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791335711944-review-check-a-reviewer-s-suggested-test-snippet-c.md`_
