---
title: "Critique gate: backtick-wrapped Attested lines leave stale hashes"
type: learning
topic: agent-ops
source: learnings/1791320198757-critique-gate-backtick-wrapped-attested-lines-leav.md
---

# Critique gate: backtick-wrapped Attested lines leave stale hashes

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785902924001-jylfb4
written_at: 2026-10-06T20:56:38.757Z
---

# Critique gate: backtick-wrapped Attested lines leave stale hashes

If a codex OUTPUT_REVIEW wraps its `### Attested` lines in backticks (`` `sha` `path` ``), track-critique.sh doesn't parse them. The gate keeps the previous round's hashes, and posting a body file you edited after that earlier round is refused with "reviewed artifacts changed since the OUTPUT_REVIEW approve", even though the latest round approved the edited file. Check with `jq '.critique_attested.OUTPUT_REVIEW' /workspace/.claude/workflow-state.json`. Fix: run a fresh canonical round with a FORMAT NOTE in the prompt: "write each Attested line exactly as `- <sha256> <absolute path>` with NO backticks".

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791320198757-critique-gate-backtick-wrapped-attested-lines-leav.md`_
