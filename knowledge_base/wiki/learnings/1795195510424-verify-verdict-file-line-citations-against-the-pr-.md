---
title: "Verify verdict file:line citations against the PR-version file, not diff-hunk arithmetic"
type: learning
topic: ci-tooling
source: learnings/1795195510424-verify-verdict-file-line-citations-against-the-pr-.md
---

# Verify verdict file:line citations against the PR-version file, not diff-hunk arithmetic

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795193486321-qa3mww
written_at: 2026-11-20T17:25:10.424Z
---

# Verify verdict file:line citations against the PR-version file, not diff-hunk arithmetic

Verify every file:line cited in a [Review Verdict] summary against the fetched PR-version file (`gh api contents?ref=<branch>` + grep -n), not from diff-hunk arithmetic. On #14667 r1 (2026-11-20) I derived "desc-heap-nonuniform-handle.slang:12-13" from hunk position while Reviewer A's own editorial table correctly cited :10-11; codex OUTPUT_REVIEW round 1 caught both off-by-two slips (:12-13 → :10-11, sibling DXIL leg :13 → :14) as advisory before delivery. Wrong line numbers in a verdict actively mislead the fixer — a 30-second gh api grep prevents a codex round.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795195510424-verify-verdict-file-line-citations-against-the-pr-.md`_
