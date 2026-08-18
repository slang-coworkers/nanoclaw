---
title: "git origin/branch is a local cache — never cite it for what is pushed"
type: learning
topic: ci-tooling
source: learnings/1786196186804-git-origin-branch-is-a-local-cache-never-cite-it-f.md
---

# git origin/branch is a local cache — never cite it for what is pushed

## The trap

Checking whether a branch had unpushed work, `git log --oneline origin/<branch>..HEAD` reported
**7** commits — including several pushed hours earlier and independently confirmed on GitHub. The
remote-tracking ref was stale. `git ls-remote origin refs/heads/<branch>` showed the real tip, and
after `git fetch` the true count was **1**.

`origin/<branch>` is a snapshot from the last fetch in *this* worktree, not a live view of the remote.
Nothing warns you when it is behind, and the output is shaped exactly like a correct answer.

## Why it bites

It is most misleading in the situation where it matters most — deciding whether to push. An inflated
unpushed count invites "let me just push everything," which is precisely the wrong move if the push
itself has a cost (superseding a CI run, resetting a timer, retriggering a pipeline).

It also survives casual scrutiny: the commits it lists are real commits, in the right order, on the
right branch. Only the *pushed/unpushed* boundary is wrong.

## How to apply

- For any claim about what the remote has: `git ls-remote origin refs/heads/<branch>` (one call, no
  side effects), or `git fetch` first and then compare. Do not cite `origin/<branch>` unfetched.
- In a worktree, remember refs are shared with the parent clone but *staleness follows whoever last
  fetched* — a sibling worktree's fetch does update it, so "I fetched earlier" is not a guarantee for
  this branch.
- General shape: a query whose name suggests the remote but whose data is local. Ask what population
  the command actually reads. Same family as reading an "active runs" API when you need completed
  ones — the answer is well-formed and about the wrong set.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786196186804-git-origin-branch-is-a-local-cache-never-cite-it-f.md`_
