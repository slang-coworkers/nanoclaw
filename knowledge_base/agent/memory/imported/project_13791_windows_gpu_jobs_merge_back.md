---
type: project
name: project_13791_windows_gpu_jobs_merge_back
description: "slang#13791 (jkwak-work, Windows GPU CI time): held as a maintainer work item until their @nv-slang-bot ask 10-21 09:17Z; bot draft PR #13813 (fork, merge Windows -dx/-vk/-cuda sub-jobs back into one job) raced jkiviluoto-nv's duplicate #13814 by 13 s; maintainers kept ours, MERGED 14:16Z (045300d41e). Terminal; nits commit ecd99a5 never pushed."
metadata:
  node_type: memory
  type: project
---

# slang#13791: merge the Windows GPU test sub-jobs back into one job — MERGED

**Terminal 2026-10-21 14:16Z.** jkwak-work merged draft-turned-ready PR #13813 (`045300d41e`, head
`71dbcc1`); its `Fixes: #13791` closed the issue. Split history: the sub-jobs came from #12422
(`b36345efe8`, 08-07). The routing check that held it before the ask is rung 4 of
[[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new]]; the hold entry is in its
[[feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new_case_log]].

## Timeline

- **10-20 hold.** jkwak-work's CI-time proposal (`CI Improvement`), assigned to them by jhelferty-nv
  11 s later; nothing to reproduce. 10-21 02:13Z comment 6306313029 mentions nobody — still held.
- **10-21 09:17Z ask.** Comment 6312449552 picks the fix (merge the sub-jobs back, not slang-test
  filter logic); 6312467323 "@nv-slang-bot can you make a PR…". Routed to slang-triager on
  `gh-issue-shader-slang/slang-13791` with `<github-post-authorized />`, as a draft. Context sent:
  open PR #13803 (jkiviluoto-nv, `-skip-api-independent-tests`) is the approach the comment rejects.
- **09:37Z triage, Approach A:** one Windows GPU job per config with no `api:` (`-api all`), plus
  `run-via-glsl: true`, the `check-ci.needs` update, dropping the unused `api` input, timeout 80→120.
  Debug estimate 85–90 min from measured vk Debug runs (75.5/70.7 min).
- **10:13Z draft #13813** (`slang-coworkers:fix/issue-13791`, +8/−96). The upstream push was refused
  for the `workflows` permission, see [[project_bot_workflows_permission]].
- **10:20Z duplicate.** jkiviluoto-nv opened #13814 (same merge-back, own fork, CI running) 13 s
  after ours. I asked the operator whether to close #13813.
- **10:52Z** jkwak-work marked #13813 ready (CI run 39587814350). I changed my recommendation to
  "keep; push the nits only after the run". **11:03Z** jkiviluoto-nv closed #13814 and approved
  #13813. jkwak-work switched the body from "Related" to `Fixes: #13791`.
- **14:16Z merged.** Measured: Debug merged job 90.9 min (76 % of the 120-min timeout), Release
  21.6 min. Post-merge comment 6319579675 (merge_group): Windows GPU runner minutes −46 %, Debug
  critical path +~20 min. Not a summons; held.

## Lessons

- **Correct a coworker's CI claim from the workflow.** "Drafts get no CI" is false: `filter.if`
  skips only `pull_request`; the bot's `workflow_dispatch` draft runs (`ci.yml:53-56`) still run.
- **Before opening a bot PR on an issue whose maintainer is working a competing approach, look for
  their parallel PR.** Here the race was 13 s, so no check could have caught it.
- **A maintainer's action can answer a pending operator question** (#13511 pattern): the ready-flip
  and the duplicate's closure settled "close #13813?" before the operator replied.
- **A maintainer's own `Fixes` overrides our "Related" brief**; the fixer keeps it.
- Never push onto a maintainer's first measuring run: `ecd99a5` (per-caller timeout, nits) stays on
  local `wip/13791-review-nits`, follow-up only if asked.
