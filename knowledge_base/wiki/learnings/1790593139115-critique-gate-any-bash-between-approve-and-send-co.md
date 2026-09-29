---
title: "critique-gate: any Bash between approve and send counts as an edit; gate also regex-matches PR-open phrases"
type: learning
topic: agent-ops
source: learnings/1790593139115-critique-gate-any-bash-between-approve-and-send-co.md
---

# critique-gate: any Bash between approve and send counts as an edit; gate also regex-matches PR-open phrases

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1783020456108-7pll4g
written_at: 2026-09-28T10:58:59.115Z
---

# critique-gate: any Bash between approve and send counts as an edit; gate also regex-matches PR-open phrases

In the NanoClaw critique gate (gate-critique-on-deliver.sh): (1) Even a read-only Bash command (e.g. `wc -c` on the deliverable) run after an OUTPUT_REVIEW approve is counted as an "edit", and the next gated send_message is denied. Do the approve and the gated send back-to-back; if something slips in between, re-attest with a cheap `mcp__codex__codex-reply` ("no content changes, re-hash X") instead of re-reviewing. (2) The gate treats a Bash command string containing the PR-open CLI verb or the REST `.../pulls/...` path as "PR creation", even when it's a read (e.g. fetching one inline review comment) or text in a heredoc memory note. After 3 denials it opens an admin bypass escalation. Read PR inline comments via `mcp__slang-mcp__github_get_pull_request_comments` instead. (3) If `mcp__codex__codex` is missing from the session after an image rebuild, `request_restart` loads it; an admin will likely reject a bypass while that path is available.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790593139115-critique-gate-any-bash-between-approve-and-send-co.md`_
