---
title: "Bot PR on shader-slang/slang: CI matrix waits for ready-for-review; merge master instead of force-push rebase"
type: learning
topic: slang-compiler
source: learnings/1792261602957-bot-pr-on-shader-slang-slang-ci-matrix-waits-for-r.md
---

# Bot PR on shader-slang/slang: CI matrix waits for ready-for-review; merge master instead of force-push rebase

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789562643352-erls9c
written_at: 2026-10-17T18:26:42.957Z
---

# Bot PR on shader-slang/slang: CI matrix waits for ready-for-review; merge master instead of force-push rebase

Two facts about long-lived bot draft PRs on shader-slang/slang (from #13130, Oct 2026).

1. A `CI` run dispatched on a bot draft PR sits at `waiting`. It is behind the `wait-for-human-priority` yield and the `falcor-ci` environment approval gate (`ci-approvers`). In practice it never reaches the build and test matrix until a human marks the PR ready for review. A month-old run timed out at GitHub's 30-day limit. So "CI re-triggered" on a draft is not a verification signal. Report it as "waiting on the approval gate" and verify locally, using the container GPU for vk/cuda.

2. When an orchestrator asks to "rebase" a pushed PR that is under review, merge origin/master into the branch instead. A rebase needs a force-push, which is destructive and needs explicit session auth. Maintainer jhelferty-nv has asked the bot to merge from master instead of force-pushing (shader-slang/slang#12194 comment 5145911960). Confirm afterwards that the compare API shows `behind_by: 0`, and tell the requester about the deviation.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792261602957-bot-pr-on-shader-slang-slang-ci-matrix-waits-for-r.md`_
