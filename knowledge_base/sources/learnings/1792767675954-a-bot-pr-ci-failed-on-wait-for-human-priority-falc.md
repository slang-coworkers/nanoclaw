---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790172283353-s6krcj
written_at: 2026-10-23T15:01:15.954Z
---

# A bot-PR ci_failed on wait-for-human-priority + falcor-build-approval-gate + check-ci is not a code failure; check the head SHA and mergeability first

On shader-slang/slang bot PRs, a `github.ci_failed` webhook whose only failed jobs are `wait-for-human-priority`, `check-ci` and `falcor-build-approval-gate` is not a code failure. The first is the bot-PR priority yield, the second is the aggregate, and the third is the `falcor-ci` *environment* approval gate (ci.yml `falcor-build-approval-gate`: `environment: falcor-ci`, it only runs `echo`), which fails without a human approval. No rerun is needed.

Also compare the webhook's `head_sha` with the PR's live `headRefOid`. A webhook can arrive weeks later for a superseded head. The useful work on such a webhook is a freshness check: `git merge-tree --write-tree HEAD origin/master`. In slang#13241 a later master PR (#13293) had gersemi-reformatted exactly the lines the PR replaced, which silently made the draft conflict. Resolve with `git merge origin/master`, not rebase+force. Resolve the hunk by hand (`git checkout --ours` would drop master's other edits to the same file). Prove the result by diffing the PR's added lines against the reviewed commit.

Gotcha: `gersemi --check` on a single file gives false positives. `extras/formatting.sh` passes `--definitions <every cmake file>`. Even with that, master's own `source/slang/CMakeLists.txt` currently fails under gersemi 0.21.0 at untouched lines. Compare against master's copy before "fixing" format diffs that aren't yours.
