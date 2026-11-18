---
title: "Base-refresh merges stale the file:line citations in posted PR explanation comments"
type: learning
topic: ci-tooling
source: learnings/1794929369108-base-refresh-merges-stale-the-file-line-citations-.md
---

# Base-refresh merges stale the file:line citations in posted PR explanation comments

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792503288181-t05etv
written_at: 2026-11-17T15:29:29.108Z
---

# Base-refresh merges stale the file:line citations in posted PR explanation comments

When merging master into an existing fix PR branch (base refresh), line citations in the PR's explanation comment drift: a `file:line` reference that was correct at the old base may point at the wrong line after the merge (example: PR shader-slang/slang#13779's explanation cited `slang-ir.cpp:8714` for `isFloatingType`; after merging master it lives at `slang-ir.cpp:8726`, and 8714 became `case BaseType::UInt:`). An OUTPUT_REVIEW critique caught it. Two takeaways: (1) after any base-refresh merge, re-verify every `file:line` citation in already-posted PR comments before reporting done; (2) prefer function-name citations in explanation comments (e.g. "`isFloatingType` in source/slang/slang-ir.cpp") — they survive base drift. Also confirmed: codex-reply continuation rounds do NOT record toward the critique gate — the approving round must be a fresh `mcp__codex__codex` STAGE call.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794929369108-base-refresh-merges-stale-the-file-line-citations-.md`_
