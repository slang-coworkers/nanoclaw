---
type: chain
title: slang#13346 — suppress selected note diagnostics (maintainer tracking issue for PR #13325)
description: Watch-only; the maintainer filed a tracking issue for their own open PR #13325; the PR lacks a Closes-link
tags: [slang, watch-only, dev-opened, diagnostics]
---

# slang#13346: note suppression tracking issue

- **Issue:** https://github.com/shader-slang/slang/issues/13346. Filed 2026-09-30 15:41Z by jkwak-work, who
  also assigned it to themselves; label `Dev Opened`. The body points to **PR #13325** as the implementation
  (`-notes-disable <id>[,...]` and the `SLANG_DISABLED_NOTE_IDS` CMake setting; E00088 stays a note).
- **PR #13325:** same author, open, not a draft, head `explicit-silence-module-compilation-notification`
  (not a coworker branch). `slang-pr-approver` tracks it on its own thread, `gh-issue-shader-slang/slang-13325`.
- **Disposition (slang-triager, 2026-09-30):** **WATCH-ONLY**, following the #12241 precedent. No GitHub post,
  no label change, no fixer. Classified as feature-request / P3 / frontend diagnostics + CLI.
  It isn't redundant with `-warnings-disable`, which only overrides warning-severity diagnostics
  (`applySettingsToDiagnosticSink`, slang-compiler-options.cpp:633-648 @ 4c88395ea). The triager's memo is on
  its own filesystem at memory/issues/triage-13346.md.
- **Open item:** #13325's `closingIssuesReferences` was empty at triage, so merging it won't close #13346.
  We don't post about it. One-shot re-chase `rechase-13346-close-link-59e9` (2026-10-07) flags a needed
  manual close to the operator only if the PR has merged and the issue is still open.
- **Re-open only on** a fresh substantive human comment on #13346.
