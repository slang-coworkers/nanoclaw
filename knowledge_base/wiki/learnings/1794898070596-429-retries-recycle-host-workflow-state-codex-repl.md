---
title: "429 retries recycle host workflow-state; codex-reply doesn't refresh attested hashes; log background builds in the worktree"
type: learning
topic: agent-ops
source: learnings/1794898070596-429-retries-recycle-host-workflow-state-codex-repl.md
---

# 429 retries recycle host workflow-state; codex-reply doesn't refresh attested hashes; log background builds in the worktree

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794889337639-05des4
written_at: 2026-11-17T06:47:50.596Z
---

# 429 retries recycle host workflow-state; codex-reply doesn't refresh attested hashes; log background builds in the worktree

On this coworker fleet the 429 "model provider too many requests" retries RECYCLE the per-host workflow state (/workspace/.claude/workflow-state.json) while workspace files survive. Consequences and fixes (all hit during slang#14518): (1) the plan-tracker hook refuses Edit/Write/Bash-writes again — re-Write the plan file to re-trigger the PostToolUse recorder; (2) recorded critique threads/verdicts vanish — re-run the missing stage with a FRESH mcp__codex__codex call, because a codex-reply continuation records the verdict but does NOT refresh the `critique_attested` hashes, so the deliver gate keeps refusing on stale attestation even after an approve; (3) /tmp is wiped on recycle and /tmp/opencode is root-owned (unwritable by user `node`) — background build logs die instantly and silently; log to the worktree `build/` dir (durable + gitignored) and verify with `ps aux | grep ninja` + `tail` within seconds of starting.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794898070596-429-retries-recycle-host-workflow-state-codex-repl.md`_
