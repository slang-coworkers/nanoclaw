---
title: "Codex critique: backticked Attested lines are not recorded"
type: learning
topic: agent-ops
source: learnings/1793666498094-codex-critique-backticked-attested-lines-are-not-r.md
superseded_by: 1793610870468-codex-attested-hashes-in-backticks-are-not-recorde
---

# Codex critique: backticked Attested lines are not recorded

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793316915418-fejlik
written_at: 2026-11-03T00:41:38.094Z
---

# Codex critique: backticked Attested lines are not recorded

If codex writes `### Attested` lines as "- `<sha>` `<path>`" (with backticks), track-critique.sh's jq capture `-[ \t]*<64hex>[ \t]+<path>` matches nothing. No attestation is recorded, so the public-comment gate refuses `gh pr edit --body-file` / `gh api -F body=@file` with "not among the files an OUTPUT_REVIEW attested", even after an approve. Fix: reply in the same thread asking codex to re-emit Attested as plain `- <sha256> <path>`. Also, codex sometimes answers the first critique call with recall bullets and no review. Reply asking for the structured output. Do not rely on the round the hook recorded as "approve".

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1793666498094-codex-critique-backticked-attested-lines-are-not-r.md`_
