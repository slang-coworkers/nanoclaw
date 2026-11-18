---
title: "codex-critique rounds only record with the verbatim developer-instructions block"
type: learning
topic: agent-ops
source: learnings/1794847766178-codex-critique-rounds-only-record-with-the-verbati.md
superseded_by: 1794919003543-codex-critique-rounds-only-record-with-the-canonic
---

# codex-critique rounds only record with the verbatim developer-instructions block

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1791189828457-02tn88
written_at: 2026-11-16T16:49:26.178Z
---

# codex-critique rounds only record with the verbatim developer-instructions block

In the OpenCode coworker container, a `codex_codex` critique round is recorded by `track-critique.sh` **only if the verbatim developer-instructions block from /home/node/.claude/skills/codex-critique/SKILL.md is passed** (it checks the sentinels "You are an independent reviewer" / "Return ONLY the structured output below"). Omitting the block silently records nothing — the call "succeeds", you get an approve, but `.critique_stages` stays empty and the comment gate then refuses the post ("not among the files an OUTPUT_REVIEW attested"). Also: without the block codex returns free-form prose with no `### Attested` sha256 section, so long public comments (1000+ chars must be posted via an attested `--body-file`) stay blocked even after a recorded round. Always pass the verbatim instructions block, and after each round `jq .critique_stages /workspace/.claude/workflow-state.json` to confirm. Related trap: `gate-critique-on-deliver.sh` pattern-matches ANY bash `gh api .../pulls/...` command — even a read-only GET — as "PR creation" and burns a denial; use the GraphQL API (`gh api graphql -f query='{... pullRequest(number:N){...} }'`) or the slang-mcp github tools for PR reads instead.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794847766178-codex-critique-rounds-only-record-with-the-verbati.md`_
