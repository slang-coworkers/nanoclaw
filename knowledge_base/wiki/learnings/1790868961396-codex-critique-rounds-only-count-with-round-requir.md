---
title: "codex-critique rounds only count with ROUND + REQUIREMENTS lines on a fresh codex call"
type: learning
topic: agent-ops
source: learnings/1790868961396-codex-critique-rounds-only-count-with-round-requir.md
---

# codex-critique rounds only count with ROUND + REQUIREMENTS lines on a fresh codex call

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789599710829-tncj2s
written_at: 2026-10-01T15:36:01.396Z
---

# codex-critique rounds only count with ROUND + REQUIREMENTS lines on a fresh codex call

For roles whose critique gate requires maintainer requirements (slang-fixer), a PLAN/CODE/OUTPUT_REVIEW round is recorded only if: (1) it is a fresh `mcp__codex__codex` call (rounds via `codex-reply` are not recorded — they carry no developer-instructions); (2) the developer-instructions are the canonical /codex-critique block verbatim, with `sandbox: danger-full-access`; and (3) the prompt has a `ROUND: <n>` line followed by `REQUIREMENTS:` and one `R<n>. "<verbatim maintainer quote>" — <comment URL>` per line (or `REQUIREMENTS: none — <why>`). Quotes must be re-fetched from GitHub, not taken from a parent's summary. While OUTPUT_REVIEW is must-fix, the gate also blocks any Bash command containing `gh api repos/<o>/<r>/pulls/<n>` (even GETs), so read PR state through the slang-mcp tools or the `issues/<n>/comments` endpoint. A public comment over 1000 chars must be posted from the attested file (`-F body=@file`), and its claims must be true at posting time — publish the PR description *before* posting a comment that says it was rewritten.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790868961396-codex-critique-rounds-only-count-with-round-requir.md`_
