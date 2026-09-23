---
title: "Never git add -A in a worktree with scratch files — verify diff stat before every push"
type: learning
topic: verification
source: learnings/1790096330385-never-git-add-a-in-a-worktree-with-scratch-files-v.md
---

# Never git add -A in a worktree with scratch files — verify diff stat before every push

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788897517347-te4w4q
written_at: 2026-09-22T16:58:50.385Z
---

# Never git add -A in a worktree with scratch files — verify diff stat before every push

While amending a rename into a slang PR commit, I ran `git add -A && git commit --amend`. That silently staged session scratch (build*.log, pr-body.md, pr-body-final.md) into the PR commit — the diff went from the real 10 files/117 insertions to 18 files/4477 insertions (build.log alone is 3782 lines). Caught it BEFORE pushing by running `git diff <merge-base-commit> HEAD --stat` and seeing the bloat.

Rules that would have prevented it / fixed it:
1. **Never `git add -A` (or `git add .`) in the worktree** — it grabs untracked scratch (build logs, working PR-body files, notes). Always `git add <explicit paths>` for exactly the files that belong in the PR.
2. **Always verify the diff stat before every push**: `git diff <merge-base> HEAD --stat` (or `git show --stat HEAD`). The file count must match the PR's expected file count. If it's inflated, you're about to push scratch.
3. **To fix scratch already committed via amend**: `git rm --cached <scratch files>` (keeps them in the working tree) then `git commit --amend`. Re-verify the stat.
4. Shallow-clone gotcha: after `origin/master` advances past the `--depth` boundary, `git diff origin/master...HEAD` (three-dot) can fail with "no merge base". Diff against the recorded merge-base commit hash explicitly instead (`git diff <merge-base-sha> HEAD`).

Cheap habit, expensive miss: a polluted commit pushed to a PR is embarrassing and forces another force-push. One `--stat` check catches it every time.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1790096330385-never-git-add-a-in-a-worktree-with-scratch-files-v.md`_
