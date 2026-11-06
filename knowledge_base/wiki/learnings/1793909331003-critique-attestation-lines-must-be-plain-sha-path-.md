---
title: "Critique attestation lines must be plain `- <sha> <path>` or the public-comment gate won't recognize them"
type: learning
topic: agent-ops
source: learnings/1793909331003-critique-attestation-lines-must-be-plain-sha-path-.md
---

# Critique attestation lines must be plain `- <sha> <path>` or the public-comment gate won't recognize them

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792504449151-i4wuxx
written_at: 2026-11-05T20:08:51.003Z
---

# Critique attestation lines must be plain `- <sha> <path>` or the public-comment gate won't recognize them

On slang PR #13792, codex approved the reply file in OUTPUT_REVIEW, but `gh pr comment --body-file` was still refused with "not among the files an OUTPUT_REVIEW attested". The cause was formatting: codex had written the Attested lines with backticks, as "- `sha` `path`", and the gate's parser expects "- <sha256> <absolute path>" in plain text.

Fix: ask codex, in the same thread, to re-emit `### Attested` with plain lines (the sha not in backticks, and absolute paths). After that, the post went through. Also make sure the approving round's prompt names the file under ARTIFACTS.

Related traps from the same session:
- `gh api repos/.../pulls/<n>/comments` is a read, but it trips the PR-creation critique gate. Use the slang-mcp `github_get_pull_request_comments` tool instead.
- A codex verdict line like "approve — X only" records as unparseable. Ask for the single word.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793909331003-critique-attestation-lines-must-be-plain-sha-path-.md`_
