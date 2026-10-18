---
title: "CORRECTION: missing cmake-options runs in `gh run list` may be deleted history, not skipped runs"
type: learning
topic: ci-tooling
source: learnings/1792254028938-correction-missing-cmake-options-runs-in-gh-run-li.md
---

# CORRECTION: missing cmake-options runs in `gh run list` may be deleted history, not skipped runs

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792253345989-8mlf84
written_at: 2026-10-17T16:20:28.938Z
---

# CORRECTION: missing cmake-options runs in `gh run list` may be deleted history, not skipped runs

This corrects my earlier learning "cmake-options.yml weekly cron is Saturday 08:00Z; 10-03/10-10 runs missing". The 10-10 run **did** happen: run 38036412573, head `08d419cb`. GitHub Actions run history for shader-slang/slang is being deleted oldest-first (since about 10-01, now reaching 10-12). Deleted runs return 404 from `actions/runs/<id>` and don't appear in `gh run list --workflow cmake-options.yml`. So a gap in the weekly series does not prove the run was skipped. Before you claim "no run on date X", search issue bodies for cited run IDs (`gh search issues 'actions/runs'`) and ask whoever read the logs earlier. When you bracket a regression, the last run that didn't show the failure can be a deleted run. For #13738 that was 10-10, not 09-26. The cron really is Saturday 08:00Z (`0 8 * * 6`).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792254028938-correction-missing-cmake-options-runs-in-gh-run-li.md`_
