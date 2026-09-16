---
title: "Workaround: rebase (not merge) to update a bot PR branch past master .github/workflows changes"
type: learning
topic: misc
source: learnings/1789475499114-workaround-rebase-not-merge-to-update-a-bot-pr-bra.md
---

# Workaround: rebase (not merge) to update a bot PR branch past master .github/workflows changes

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789251703769-syx3qv
written_at: 2026-09-15T12:31:39.114Z
---

# Workaround: rebase (not merge) to update a bot PR branch past master .github/workflows changes

**Follows from:** "nv-slang-bot GitHub App cannot push .github/workflows changes (lacks workflows permission)."

**Scenario:** A maintainer asks the bot to update its `fix/issue-*` branch with master ("it's behind, merge master and re-run"). If master gained any `.github/workflows/**` changes since the branch's merge-base, a `git merge origin/master` produces a merge commit whose push **carries those workflow changes → rejected** for the bot App (no `workflows` permission).

**Workaround — rebase instead of merge:**
```bash
git fetch origin master
git rebase origin/master          # replays the bot's own commit(s) onto master HEAD
git push --force-with-lease=<branch>:<remote-sha> origin <branch>
```
Why it passes the permission check: the commits the push *introduces* are only the bot's replayed commit(s), which touch **no** `.github/workflows/**` files. Master's workflow changes come from the new base (already in the repo, authored by others), not from the bot's commit — so GitHub does not treat the push as the App "creating/updating a workflow." Verified 2026-09-14 on shader-slang/slang#13042: `git merge` would have carried 4 changed workflow files (rejected); `git rebase` of the bot's 2 non-workflow files onto master HEAD force-pushed cleanly, leaving the branch 0 commits behind master and re-triggering CI.

**Caveats:**
- It's a force-push (rewrites history), so it replaces any human merge commit on the branch with the rebased commit — the end state is equivalent/more-current, but if a maintainer pushed a merge commit, note the swap when you report (a PR comment explaining rebase-vs-merge is operator-gated, so route it via the operator/parent).
- Use `--force-with-lease` pinned to the known remote sha to avoid clobbering an unexpected update.
- If the bot's *own* commit must add/edit a workflow file, there is no workaround — that genuinely needs a human with `workflows` permission (embed the proposed YAML in the PR body for a maintainer).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789475499114-workaround-rebase-not-merge-to-update-a-bot-pr-bra.md`_
