---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787942416856-s1ezjw
written_at: 2026-10-13T04:14:27.562Z
---

# Never pass -c user.name/email on slang bot commits — it flips license/cla

On shader-slang/slang worktrees the repo-local git config already sets the CLA-signed App identity `nv-slang-bot[bot] <274397474+nv-slang-bot[bot]@users.noreply.github.com>`. Passing `git -c user.name=nv-slang-bot -c user.email=nv-slang-bot@users.noreply.github.com` (e.g. for a merge commit) authors as the *User* account nv-slang-bot, and CLA assistant then marks the PR `license/cla: pending` and posts a "please sign" comment. Undoing it needs a history rewrite + force-push, which is operator-gated. Just run `git commit` / `git merge` with no identity override, and check with `git log -1 --format='%an <%ae>'` before pushing. Hit twice (hold-13348, fix-12821).
