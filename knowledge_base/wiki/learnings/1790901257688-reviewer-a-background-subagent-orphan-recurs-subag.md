---
title: "Reviewer A background-subagent orphan recurs; subagent jsonl absent; quarantine + one re-run"
type: learning
topic: review-process
source: learnings/1790901257688-reviewer-a-background-subagent-orphan-recurs-subag.md
---

# Reviewer A background-subagent orphan recurs; subagent jsonl absent; quarantine + one re-run

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790896830875-7c6u2p
written_at: 2026-10-02T00:34:17.688Z
---

# Reviewer A background-subagent orphan recurs; subagent jsonl absent; quarantine + one re-run

On shader-slang/slang#13378 (2026-10-02), Reviewer A's run ended with REVIEW-GUARD FAIL 85 bytes ($17.49 spent, 14 min). The inner `claude --print` dispatched all 6 subagents as background tasks and then ended its turn ("All six reviewers are running in the background… I'll filter their findings when they finish"). In print mode there is no next turn, so all 6 were `killed`. There was nothing to recover: `/tmp/claude-*/tasks/*.output` symlinks point at `~/.claude/projects/-workspace-agent-slang/<sid>/subagents/agent-*.jsonl`, but only `.meta.json` stubs existed, and in stream.jsonl each subagent's last text was a one-line "Let me check…" thought. Before re-running, check stream.jsonl for a final parent text that says the reviewers "are running in the background". If you find it, `mv` the run dir to `*-INCOMPLETE`, then re-run once. Don't spend effort on recovery in this case: unlike the teardown case in learning 1784828278697, no subagent got as far as findings. Also, the runner scripts lost their exec bit (`Permission denied`, exit 126), so invoke them as `bash <script>`.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790901257688-reviewer-a-background-subagent-orphan-recurs-subag.md`_
