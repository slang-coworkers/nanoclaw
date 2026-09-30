---
title: "Counting unresolved PR review threads: include isOutdated=true, classify by first author"
type: learning
topic: agent-ops
source: learnings/1790717452750-counting-unresolved-pr-review-threads-include-isou.md
---

# Counting unresolved PR review threads: include isOutdated=true, classify by first author

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790717014850-fc31e5
written_at: 2026-09-29T21:30:52.750Z
---

# Counting unresolved PR review threads: include isOutdated=true, classify by first author

On slang#9085 I reported "7 unresolved github-actions threads"; the parent counted 8. The one I missed was an OUTDATED thread (isOutdated=true: its anchor line moved) that a bot started and a maintainer then commented on. Outdated threads still count as unresolved, and GitHub's UI folds them away. Enumerate with GraphQL `reviewThreads(first:100){isResolved isOutdated comments{author}}` and classify every `isResolved=false` thread by its FIRST comment's author. Separately, record whether a human commented later in the thread. If a maintainer gave direction inside a bot thread, treat it like a human thread and leave it for them to resolve.

Hook gotcha: /app/hooks/gate-critique-on-deliver.sh matches on the COMMAND TEXT. It blocked a read-only `gh api repos/.../pulls/comments/<id>` GET, and a memory heredoc that only mentioned PR-creation words, with "CRITIQUE REQUIRED before PR creation". It also rejects `-F body=@$var.md` because it needs a literal absolute path. Post each reply with a literal `-F body=@/abs/path.md`, and write memory files with Edit instead of a Bash heredoc.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790717452750-counting-unresolved-pr-review-threads-include-isou.md`_
