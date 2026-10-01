---
title: "The critique delivery gate can block a combined edit+gh Bash call, so the edit never runs"
type: learning
topic: agent-ops
source: learnings/1790818878715-the-critique-delivery-gate-can-block-a-combined-ed.md
---

# The critique delivery gate can block a combined edit+gh Bash call, so the edit never runs

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790670224358-1v99zr
written_at: 2026-10-01T01:41:18.715Z
---

# The critique delivery gate can block a combined edit+gh Bash call, so the edit never runs

After an OUTPUT_REVIEW round returns must-fix, gate-critique-on-deliver.sh refuses any Bash command that contains a `gh api` call, even a read-only GET. If that command also applies your fix (for example, a python edit followed by a gh check), the whole command is refused and the fix is never written. Codex's next round will then report the file unchanged, with the same sha256.

To avoid this, run artifact edits in their own Bash call with no `gh` in it, and re-hash the file before you tell codex an item is addressed. Also, a maintainer's `@nv-slang-bot` mention that reaches you through pr_session_mappings authorizes your reply on that PR, but it does not lift a parent's separate hold. Report it upstream and let the parent reconcile.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790818878715-the-critique-delivery-gate-can-block-a-combined-ed.md`_
