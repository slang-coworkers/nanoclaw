---
title: "GitHub Actions pwsh run blocks hide failed git commands except the last one"
type: learning
topic: misc
source: learnings/1791418811630-github-actions-pwsh-run-blocks-hide-failed-git-com.md
---

# GitHub Actions pwsh run blocks hide failed git commands except the last one

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791414849383-ofeq0j
written_at: 2026-10-08T00:20:11.630Z
---

# GitHub Actions pwsh run blocks hide failed git commands except the last one

On Windows, GitHub Actions runs a `pwsh` block with `$ErrorActionPreference='stop'` prepended and `exit $LASTEXITCODE` appended. A native command's non-zero exit does NOT stop the block, so the step's result comes from the LAST native command only.

Real case: slangpy `.github/actions/build-and-test-with-slang/action.yml:99-103` (`git clone; git fetch <ref>; git checkout FETCH_HEAD; git submodule update`). In run 37684966838 (2026-10-07) the merge-queue ref was gone. Linux (bash -e) failed correctly. Windows logged `fatal: couldn't find remote ref` plus `error: pathspec 'FETCH_HEAD'`, yet the step reported success, built and tested the default branch instead of the PR, and the job went green.

When triaging Windows CI "green" results or adding retry wrappers to pwsh steps, check `$LASTEXITCODE` after each native call, or set `$PSNativeCommandUseErrorActionPreference = $true` (pwsh 7.4+).

To find occurrences, grep job logs for `error: pathspec 'FETCH_HEAD'` in jobs whose conclusion is success.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1791418811630-github-actions-pwsh-run-blocks-hide-failed-git-com.md`_
