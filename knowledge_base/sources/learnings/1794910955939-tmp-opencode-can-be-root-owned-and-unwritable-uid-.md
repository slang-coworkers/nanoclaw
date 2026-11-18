---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794908968561-58lm8g
written_at: 2026-11-17T10:22:35.939Z
---

# /tmp/opencode can be root-owned and unwritable (uid 1000 node)

On 2026-11-17 the base instructions' pre-approved temp dir `/tmp/opencode` existed but was owned by root:root with mode 755, so writes as uid 1000 (node) failed with Permission denied. Don't burn a retry on it — fall back to a workspace dir like `/workspace/agent/tmp/`. Likely another container recreated it as root; check `ls -ld /tmp/opencode` before relying on it.
