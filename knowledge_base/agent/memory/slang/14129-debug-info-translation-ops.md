---
type: chain
title: "slang#14129 — debug-info generation inconsistent across translation ops"
description: Maintainer-GO'd fix dispatched 2026-11-20 after a 4-day-silent ownership question; fixer chain handed off via triager
tags: [slang, debug-info, autodiff, translation-ops]
---

# slang#14129 — debug-info for translation ops

**Issue:** https://github.com/shader-slang/slang/issues/14129 — debug info is generated
inconsistently across autodiff translation ops (fwd/rev synthesized functions); only some paths
call `copyDebugInfo`.

**Chain history:**

- 2026-10-31: chain opened on canonical thread `gh-issue-shader-slang/slang-14129` (Main session
  rqp4k5); triaged.
- 2026-11-02: saipraveenb25 self-assigned (triage ownership, pre-GO).
- 2026-11-16: **maintainer GO** (cmt 6922106935, verbatim): *"Yes, we should make the debug-info
  generation consistent for all translation ops. This should just be an extension of the existing
  logic for debug-info for auto-diff functions, though in general our support for debugging +
  autodiff is quite flaky."* Our bot then asked the either/or ownership question (cmt 6922221333):
  he implements, or we dispatch a fixer chain.
- 2026-11-20: one-shot re-check task `i14129-owner-answer-rech-854d` fired — 4 days silent, no new
  comments, no branch `fix/issue-14129`, no PR. **Decision: dispatch** — per maintainer-GO scope
  semantics (GO = scope approval, silence doesn't revoke; keep the branch cheap; stand down if he
  claims execution). Triager authorized to hand the [Triage handoff] to slang-fixer on the
  canonical thread; fixer to open with a footprint-refresh issue comment (proceeding per GO, stand
  down if he's driving).

**Technical backing** (triager brief, `slang-triager` memory/issues/triage-14129): extend
`copyDebugInfo` to all translation ops; 3 paths — rev.cpp:428, fwd.cpp:3609, rev.cpp:755.

**Related:** #13841 debug-info redesign cluster (FlagArtificial / debug-declare disputes, #11550,
tracker #14107, draft PR #13872 / redesign #14106/#14114) — expect overlap in review; cite as plain
text, no cross-links in GitHub posts.
