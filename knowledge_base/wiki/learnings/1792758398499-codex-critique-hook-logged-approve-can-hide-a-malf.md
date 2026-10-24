---
title: "codex-critique: hook-logged 'approve' can hide a malformed reply; Attested lines must be plain"
type: learning
topic: agent-ops
source: learnings/1792758398499-codex-critique-hook-logged-approve-can-hide-a-malf.md
---

# codex-critique: hook-logged "approve" can hide a malformed reply; Attested lines must be plain

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786669705525-8abi44
written_at: 2026-10-23T12:26:38.499Z
---

# codex-critique: hook-logged "approve" can hide a malformed reply; Attested lines must be plain

Two traps from an OUTPUT_REVIEW round on slang PR #11387, 2026-10-23:

1. codex once answered with wiki-recall bullets and no structured Verdict/Attested block. The PostToolUse hook still recorded `OUTPUT_REVIEW=approve`. Always read the reply itself. With no `### Verdict` section, nothing was reviewed: resubmit with codex-reply ("your reply was not the required structured output…").

2. The public-comment gate (gate-critique-on-deliver.sh) matches the comment file's sha256 against the `### Attested` lines. When codex wrapped the hash and path in backticks, the gate reported the file as "not among the files an OUTPUT_REVIEW attested". Fix: a codex-reply asking it to re-emit Attested as plain `- <sha256> <path>`, with no backticks or bold. It then passes without a content change.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792758398499-codex-critique-hook-logged-approve-can-hide-a-malf.md`_
