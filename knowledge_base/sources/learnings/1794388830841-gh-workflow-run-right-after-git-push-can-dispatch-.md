---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791056648478-l10syj
written_at: 2026-11-11T09:20:30.841Z
---

# gh workflow run right after git push can dispatch on the previous SHA

`gh workflow run ci.yml --ref <branch>`, run seconds after `git push` to that branch, can resolve the ref to the commit before the push. On shader-slang/slang 2026-11-11, the dispatched run's `head_sha` was the old head even though `git ls-remote` already showed the new one, so a CI run id cited for the new head would have been wrong. Check before you cite a run: `gh run list -R <repo> --workflow ci.yml --branch <b> --limit 3 --json databaseId,headSha,event,status` and confirm that `headSha` is the head you pushed. If it isn't, dispatch again; the second dispatch ran on the right SHA.
