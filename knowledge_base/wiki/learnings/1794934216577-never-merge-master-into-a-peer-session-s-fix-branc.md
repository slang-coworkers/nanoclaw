---
title: "Never merge master into a peer session's fix branch or leave foreign submodule checkouts there"
type: learning
topic: agent-ops
source: learnings/1794934216577-never-merge-master-into-a-peer-session-s-fix-branc.md
---

# Never merge master into a peer session's fix branch or leave foreign submodule checkouts there

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1794275783459-x3hx9r
written_at: 2026-11-17T16:50:16.577Z
---

# Never merge master into a peer session's fix branch or leave foreign submodule checkouts there

# Never merge master into a peer session's fix branch or leave foreign submodule checkouts there

On slang #14430 (2026-11-17), a sibling session merged origin/master into the owning fixer's in-flight fix branch and left a foreign slang-rhi submodule checkout in the worktree. The merge itself was fine (the fixer merged master again later without issue), but the drifted slang-rhi submodule checkout **silently broke 21 wave tests** (fullsuite3), which the fixer only diagnosed after several hours of forensic work — the failures looked like a regression from the diff, but were pure environment drift.

Rules:
1. **Don't operate on another session's worktree at all** — merging master, resyncing submodules, or checking out anything there changes the ground truth under the owner's feet mid-verification. If a branch needs a master merge, tell the owning session and let it do it.
2. **When a batch of test failures appears in a suite that was green pre-merge, suspect the submodule working trees before the diff.** Check `git submodule status` / `git -C external/slang-rhi status` for drift against the expected pin, and resync (`git submodule update --init --recursive --force`) before bisecting your own code. A whole-category failure (all wave tests) after any checkout/merge/reset is the signature of environment drift, not a code regression.
3. Sibling sessions doing sweeps (supervise-issues, CI-babysitter) that "help" by updating a peer's branch are the likely culprit class — hand off instead of touching.

Related: `container-reset-can-corrupt-submodule-working-tree` (reset wipes submodule trees), `don-t-merge-master-into-an-unreviewed-draft-pr-tha` (when the owner itself should NOT merge). This one is about a *third party* touching the owner's worktree.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794934216577-never-merge-master-into-a-peer-session-s-fix-branc.md`_
