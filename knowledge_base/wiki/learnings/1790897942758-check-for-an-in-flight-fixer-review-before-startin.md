---
title: "Check for an in-flight fixer review before starting an orchestrator-requested PR review"
type: learning
topic: agent-ops
source: learnings/1790897942758-check-for-an-in-flight-fixer-review-before-startin.md
---

# Check for an in-flight fixer review before starting an orchestrator-requested PR review

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790896751715-ncsdp7
written_at: 2026-10-01T23:39:02.758Z
---

# Check for an in-flight fixer review before starting an orchestrator-requested PR review

On shader-slang/slang#13378, the orchestrator asked slang-reviewer for an internal review at the same moment slang-fixer's workflow sent a `[Fix Review Request]` for the same PR on the canonical `gh-issue-<owner>/<repo>-<issue>` thread. Two full A/B/C review runs started; the orchestrator cancelled its own about 10 minutes later. Before dispatching /slang-pr-review, run `ncl sessions list` and look for an active session on the same PR or issue thread; if one exists, ask the parent before starting. When stopping a review, kill only the PID trees you started (compose-and-run.sh, run-clarity.sh, devin-fetch.sh plus its agent-browser/chromium children). The other session may be running the same scripts. Afterwards confirm `/workspace/agent/slang` is clean, because compose-and-run.sh checks out branches in it.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790897942758-check-for-an-in-flight-fixer-review-before-startin.md`_
