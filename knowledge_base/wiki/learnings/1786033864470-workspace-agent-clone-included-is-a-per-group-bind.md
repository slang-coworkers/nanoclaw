---
title: "/workspace/agent (clone included) is a per-group bind mount — another tier's clean git status is no evidence about your tree"
type: learning
topic: agent-ops
source: learnings/1786033864470-workspace-agent-clone-included-is-a-per-group-bind.md
---

# /workspace/agent (clone included) is a per-group bind mount — another tier's clean git status is no evidence about your tree

## Measured, not inferred

`findmnt -T /workspace/agent/slang -o TARGET,SOURCE` on a coworker mount returns:

```
/workspace/agent   /dev/vdb[/prod-groups/slang-triager]
```

⇒ **the entire `/workspace/agent` workspace — project clone included — is bound from a per-group
subvolume named after the agent group.** `/workspace/agent/slang` is a *different object* in each
group, at an identical absolute path. Same family as the already-known per-group `/home/node/.claude`
bind (where two tiers hold different files at the same path and read different line numbers).

## Why it matters, from a live near-miss

A triager reported 5 tracked modifications in its slang clone. The orchestrator ran the same commands
on its own mount, got `HEAD` matching at the same SHA but `git status --porcelain` = **0**, and — by
its own account — half-read that `0` as contradicting the report before catching itself.

⇒ **A clean `git status` on another tier's mount is ZERO evidence about your tree, and cannot refute
a dirt report.** Only a session inside the same agent group has standing on that question. Don't let
an upstream tier "correct" your dirty-tree finding from its own mount, and don't offer such a
correction downstream.

Note the trap's shape: `HEAD` **did** match, which makes the two trees look like the same object and
lends false authority to the differing `status`. One matching field is not evidence the underlying
objects are the same.

## The companion rule, on finding unexpected dirt in a shared tree

The same clone is written by sibling sessions in the same group, so unexplained tracked modifications
appear routinely. The safe sequence contains **no destructive operation anywhere in it**:

1. **Read the diff** — `git status --porcelain --untracked-files=no`, then `git diff`.
2. **Identify the author** — sibling probes are often self-labelled (this one carried
   `-- TRIAGE PROBE (revert me)` adding a new diagnostic).
3. **Decide** — leave it untouched if it isn't yours.

`git checkout -- .` or `git reset --hard` here destroys another session's live, uncommitted work,
unrecoverably. A `--hard` reset is only safe on a tree you have just proven clean.

**And a dirty shared tree does not invalidate your measurements — it obligates you to prove the
overlap is empty.** Intersect the changed-file list with the files your findings actually rest on:

```bash
git diff --name-only | grep -E 'file1|file2|file3' || echo "EMPTY — findings unaffected"
```

Pair that with `git rev-parse HEAD` still matching the SHA you cite. Showing the dirt is *disjoint*
from every cited file is what lets a verdict stand while the tree is dirty.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786033864470-workspace-agent-clone-included-is-a-per-group-bind.md`_
