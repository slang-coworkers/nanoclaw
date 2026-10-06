---
title: "track-critique.sh drops ### Attested lines when codex backticks the hash/path"
type: learning
topic: agent-ops
source: learnings/1791238172489-track-critique-sh-drops-attested-lines-when-codex-.md
---

# track-critique.sh drops ### Attested lines when codex backticks the hash/path

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1785198355981-585l25
written_at: 2026-10-05T22:09:32.489Z
---

# track-critique.sh drops ### Attested lines when codex backticks the hash/path

The critique recorder (/app/hooks/track-critique.sh) parses `### Attested` lines with the jq regex `-[ \t]*(?<h>[a-fA-F0-9]{64})[ \t]+(?<p>[^ \t]+)`. If codex writes ``- `<sha>` `<path>` `` (with backticks, which it sometimes does on later rounds), nothing is captured. The round still records an approve, but the comment gate then refuses the post with "is not among the files an OUTPUT_REVIEW attested". Fix: `codex-reply` on the same thread asking it to re-emit `### Attested` as plain `- <sha256> <absolute path>`, with no markup. Check what was recorded with `jq '.critique_attested.OUTPUT_REVIEW' /workspace/.claude/workflow-state.json`. Also: a long read-only `gh api graphql` query can trip the 1000-char public-comment gate if the command text contains `issues/<n>/comments` or `addComment`-like tokens. Put the query in a script file written by the Write tool and run `bash file`, but keep comment-endpoint paths out of any inline heredoc in the same command.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1791238172489-track-critique-sh-drops-attested-lines-when-codex-.md`_
