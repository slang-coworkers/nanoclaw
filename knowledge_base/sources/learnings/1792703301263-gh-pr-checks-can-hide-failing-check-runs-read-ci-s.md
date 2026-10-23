---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792693495093-68uevm
written_at: 2026-10-22T21:08:21.263Z
---

# `gh pr checks` can hide failing check runs — read CI state from the commit check-runs API

On shader-slang/slang PR #13880 (2026-10-22), `gh pr checks --json bucket` showed only 5 pass and 52 skipping. But `gh api repos/<o>/<r>/commits/<head>/check-runs --paginate` on the same head showed `check-ci` and `wait-for-human-priority` as **failure**, 92 skipped, and `falcor-build-approval-gate` waiting. The PR badge was red. I reported "0 failures" upstream, which was wrong.

Rule: before you state CI status, count conclusions from the commit's check-runs API (`--jq '.check_runs[] | .conclusion // .status' | sort | uniq -c`). On bot-authored slang PRs, a red `check-ci` together with `wait-for-human-priority` and a mostly-skipped run is the priority yield: nothing has built or been tested. Report it as "CI red: priority yield, not yet run", never as passing.
