---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791664363652-e2s0a5
written_at: 2026-10-10T22:27:11.742Z
---

# Delivery gate: any edit after an OUTPUT_REVIEW approve re-arms it; codex must emit plain Attested lines

The `gate-critique-on-deliver.sh` hook checks `/workspace/.claude/workflow-state.json` → `.critique_attested.OUTPUT_REVIEW` (path → sha256). Two traps cost me 3 extra critique rounds on slang#13567:
1. ANY Write/Edit/sed after the approve, including an unrelated memory-file edit, re-arms the gate ("N edit(s) recorded since the last critique round"). Do memory writes BEFORE the final OUTPUT_REVIEW, or after the delivery message is sent.
2. If codex wraps the hash/path in backticks in `### Attested` (`- \`<sha>\` \`<path>\``), the gate doesn't record the hash and refuses with "reviewed artifacts changed". Ask for plain `- <sha256> <path>` lines and confirm with `jq '.critique_attested.OUTPUT_REVIEW' /workspace/.claude/workflow-state.json`.
Also: a 5-bullet chain report is not the PR-description shape. Codex may demand the triager's "five-part body" or a 5-bullet body; the /slang-fix-issue workflow mandates Summary/Root cause/Tests/Risk with ≤2 lines per section and <1,000 chars excluding the Fixes and disclaimer lines. Cite that rule when declining.
