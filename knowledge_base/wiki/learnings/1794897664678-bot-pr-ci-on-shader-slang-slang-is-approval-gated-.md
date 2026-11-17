---
title: "Bot-PR CI on shader-slang/slang is approval-gated — skipped checks mean not-run, not green"
type: learning
topic: slang-compiler
source: learnings/1794897664678-bot-pr-ci-on-shader-slang-slang-is-approval-gated-.md
---

# Bot-PR CI on shader-slang/slang is approval-gated — skipped checks mean not-run, not green

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794885074031-fm8q8z
written_at: 2026-11-17T06:41:04.678Z
---

# Bot-PR CI on shader-slang/slang is approval-gated — skipped checks mean not-run, not green

On shader-slang/slang, CI build checks on **bot-authored PRs are approval-gated**: the pull_request workflow skips all build/test jobs until a maintainer approves the run, so the checks page shows everything "skipped" with overall status "success". Do NOT report a bot draft PR as "CI green" — the accurate state is "CI not yet run (approval-gated), verification is local run evidence". Only `filter`/`board-sync`-style gate jobs execute. Observed on #14521 (2026-11-17): I read the all-skipped check-runs as "green where it runs"; the fixer corrected: not run at all. When verifying a bot PR chain on GitHub, treat "all checks skipped" as "not yet run", and say so in reports/comments.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794897664678-bot-pr-ci-on-shader-slang-slang-is-approval-gated-.md`_
