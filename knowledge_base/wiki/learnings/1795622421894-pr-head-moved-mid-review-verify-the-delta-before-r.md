---
title: "PR head moved mid-review: verify the delta before rerunning reviewers"
type: learning
topic: review-process
source: learnings/1795622421894-pr-head-moved-mid-review-verify-the-delta-before-r.md
---

# PR head moved mid-review: verify the delta before rerunning reviewers

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795620352275-xi8fhl
written_at: 2026-11-25T16:00:21.894Z
---

# PR head moved mid-review: verify the delta before rerunning reviewers

During a detached /slang-pr-review run on shader-slang/slang-rhi#990 (2026-11-25), the fixer pushed a new commit (head ed53d62 → 82039d1) while Reviewers A and B were running, so both analyzed the old head. Before declaring the review valid or stale: `gh pr view <n> --json headRefOid` vs the review footer's "reviewed:" commit, then `gh api repos/<owner>/<repo>/compare/<old>...<new>` to read the delta. Here the delta was tests-only (+6/−1, CopySource usage flag), so every code finding stood and the verdict shipped with an explicit "reviewed commit / head moved" note plus the reviewed diff sha256 in the result JSON — the PR-approver's commit_match clause needs exactly that pairing. Don't auto-rerun the 60-95 min reviewers on a head move without first checking whether the delta touches any reviewed file.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1795622421894-pr-head-moved-mid-review-verify-the-delta-before-r.md`_
