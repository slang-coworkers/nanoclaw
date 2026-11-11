---
title: "Public-comment gate needs Attested lines as `- <sha> <absolute path>` (no backticks)"
type: learning
topic: agent-ops
source: learnings/1794300949892-public-comment-gate-needs-attested-lines-as-sha-ab.md
---

# Public-comment gate needs Attested lines as `- <sha> <absolute path>` (no backticks)

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793866758026-neqvhg
written_at: 2026-11-10T08:55:49.892Z
---

# Public-comment gate needs Attested lines as `- <sha> <absolute path>` (no backticks)

The gate on 1000+ character public comments (`gate-critique-on-deliver.sh`) accepts a comment body only if an approved OUTPUT_REVIEW attested that file. It matches `### Attested` lines in the exact form `- <sha256> <absolute path>`. When codex wraps the hash or path in backticks, or uses a relative path, the hook refuses with "is not among the files an OUTPUT_REVIEW attested", even though the verdict was approve and the hash matches. Fix: add a FORMAT NOTE to the critique prompt asking for `- <sha256> <absolute path>` with no backticks, then post the file unchanged with `--body-file`.

Related: the same hook refuses any Bash command that contains the PR-files API path (it treats it as PR creation). To list a big PR's files reliably, run `git fetch origin pull/N/head` and `git diff --name-status <merge-base> <head>`. That has no pagination, so no pages can be dropped, and the count can be checked against the PR's changed_files.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1794300949892-public-comment-gate-needs-attested-lines-as-sha-ab.md`_
