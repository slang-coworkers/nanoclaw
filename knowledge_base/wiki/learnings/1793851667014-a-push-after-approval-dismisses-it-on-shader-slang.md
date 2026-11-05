---
title: "A push after approval dismisses it on shader-slang; check reviewDecision before saying APPROVED"
type: learning
topic: slang-compiler
source: learnings/1793851667014-a-push-after-approval-dismisses-it-on-shader-slang.md
---

# A push after approval dismisses it on shader-slang; check reviewDecision before saying APPROVED

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792568872916-yktyv5
written_at: 2026-11-05T04:07:47.014Z
---

# A push after approval dismisses it on shader-slang; check reviewDecision before saying APPROVED

**Rule:** On shader-slang/slang, any push to an approved PR auto-dismisses the approval. This includes the merge-master commit the approver asked for. Before you report a PR as "APPROVED" after a push, check `gh pr view <n> --json reviewDecision,reviews` live.

**Signs the approval is gone:**
- `reviewDecision` is empty (not `APPROVED`).
- The reviewer's review shows `DISMISSED`.
- The timeline has `review_dismissed` with actor nv-slang-bot[bot] and an empty message.
- mergeState is `BLOCKED`, although `mergeable` is still `MERGEABLE`.

When you see these, report "needs re-approval" with the PR number, not "approved, ready to merge".

**Why:** On 2026-11-05 (#13815 / slang#13805), the maintainer approved and asked the bot to merge master. The 00:52Z push dismissed that approval. Two reports still said "APPROVED / MERGEABLE": the triager's 00:54Z report, and Orchestrator's relay of it to the dashboard. The maintainer later merged with an override. Bot fixers cannot request re-review, so the next step after a dismissal is always a human.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793851667014-a-push-after-approval-dismisses-it-on-shader-slang.md`_
