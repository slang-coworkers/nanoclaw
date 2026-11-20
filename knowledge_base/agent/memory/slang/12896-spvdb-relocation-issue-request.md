---
type: chain
title: "PR #12896 (merged) — maintainer-requested spvdb-relocation tracking issue"
description: jkwak-work asked via @nv-slang-bot mention to file+assign an issue for moving spvdb source out of tests/; fixer owns the filing; do NOT re-dispatch the resulting bot-filed issue_opened.
tags: [pr-mention, spvdb, maintainer-request]
---

# PR #12896 — spvdb relocation tracking issue (maintainer request)

- **PR:** shader-slang/slang#12896 — "Vendor spvdb and add SPVDB_DEBUGGER regression tests under tests/debuginfo" (zangold-nv, MERGED 2026-09-09 at `585a5710`). Vendored spvdb source under `tests/spvdb/`.
- **Request:** 2026-11-16 21:52Z, `pr_mention` comment 6930486063 by **jkwak-work** (maintainer), real `@nv-slang-bot` mention, thread `gh-pr-shader-slang/slang-12896`:
  > @nv-slang-bot please file a github issue and assign it to me.
  > The source code implementation for spvdb shouldn't be located under `tests/` directory.
  > A proper location will be `source/tools` or `external/spvdb` as an external repo.
- **Dispatch:** 11-16 21:54Z → slang-fixer, MODE=pr-review-fix, session `sess-1794866067941-kae0zu` (delivery verified). Fixer to: dedupe-check, file the issue (presenting BOTH location options as the maintainer wrote them), assign jkwak-work, reply on the PR comment with the issue link, report back on the thread.
- ⚠️ **The resulting issue is bot-filed at a maintainer's request — when its `issue_opened` webhook arrives, do NOT dispatch triage/fixer; this chain already owns it.** (Greppable marker: 12896.)
- **Issue filed:** #14516 "Move spvdb source out of tests/ (source/tools or external/spvdb)" at ~22:26Z 11-16, nv-slang-bot[bot], **assignee jkwak-work** (verified live; his `issue_opened` webhook arrived 22:26 and was dispositioned as no-dispatch per this record). Both location options presented as the maintainer wrote them. NOT dispatched on arrival.
- **Status:** TERMINAL 11-16 22:29Z — fixer reported done; verified by Main via gh api: #14516 open + assignee jkwak-work confirmed, reply posted on PR comment 6931315225 ("@jkwak-work Filed and assigned to you per your request above: #14516"). Next action is human: jkwak-work picks `source/tools` vs `external/spvdb` and drives relocation on #14516; any further @nv-slang-bot mention there is a live inbound.
