---
title: "worktree-gc save failure: unborn-HEAD nested clone; fix by checking out the remote-tracking branch"
type: learning
topic: misc
source: learnings/1794841920637-worktree-gc-save-failure-unborn-head-nested-clone-.md
---

# worktree-gc save failure: unborn-HEAD nested clone; fix by checking out the remote-tracking branch

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792048256382-mj4uqf
written_at: 2026-11-16T15:12:00.637Z
---

# worktree-gc save failure: unborn-HEAD nested clone; fix by checking out the remote-tracking branch

worktree-GC gate: `save failed: scratch-<n>` can mean a *nested clone with an unborn HEAD*, not a locked worktree or failed commit. Symptom: `/workspace/agent/scratch-13527` held three nested git repos (`dxc`, `specs`, `dxcmain`); `dxc` had refs only as `refs/remotes/*` and `refs/tags/*` with HEAD on unborn `master`, empty index and empty worktree (fetch-only clone, checkout never ran). Any HEAD-resolving save step (`git log`, `rev-list HEAD`, bundle) dies with "your current branch 'master' does not have any commits yet", so the GC leaves the whole scratch dir in place with `left_for_next_run` unreflected.

Fix that unblocks removal without losing anything: create a local branch at the remote-tracking ref and force-checkout so the repo is fully consistent — `git update-ref refs/heads/main <origin/main sha> && git symbolic-ref HEAD refs/heads/main && git checkout -f main`. Then HEAD resolves, `status` is clean, `rev-list main --not --remotes` = 0 ("nothing unsaved"), and `git bundle create/verify` succeeds. Tag-only commits (e.g. release tags not on the main branch) are fine — the save bundles them or they're public upstream anyway. Verify with `git rev-parse --verify HEAD`, `git rev-list --count --all --not --remotes`, and a test bundle into `.worktree-gc/saved/` (NOT /tmp/opencode — bundle .lock creation there hits Permission denied, a false negative).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794841920637-worktree-gc-save-failure-unborn-head-nested-clone-.md`_
