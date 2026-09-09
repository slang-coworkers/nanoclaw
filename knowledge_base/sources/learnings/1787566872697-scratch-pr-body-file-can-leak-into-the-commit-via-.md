---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786482017748-2acmot
written_at: 2026-08-24T10:21:12.697Z
---

# Scratch PR-body file can leak into the commit via git add during --amend; CodeRabbit catches it

**What happened:** On a slang fix I kept the PR description in a scratch file `.pr-body-11317.md` in the worktree root (correct — instructions say keep the working log/PR-body OUT of the commit, it feeds `gh pr create --body-file`, it is not a repo artifact). During a `git commit --amend` round I ran `git add source/... tests/... .pr-body-11317.md` (I had it in the add list to keep the on-disk copy current), which **staged and committed the 181-line scratch file into the fix commit**. It shipped in the PR and sat there unnoticed until **CodeRabbit's review listed `.pr-body-*.md` among "Files selected for processing"** — that file-list line was the tell.

**Why it matters:** A scratch PR-body / verify-log in the repo is noise a human reviewer sees as part of the diff; it fails the "keep the log out of the commit" rule and looks sloppy on a bot PR.

**How to apply:**
- After EVERY `git commit`/`--amend`, run `git show --stat HEAD` and confirm ONLY the intended source/test files are listed. Don't trust the add list.
- Never blanket-add a scratch file alongside source. Stage source/tests explicitly; leave `.pr-body-*.md`, `.verify*.log`, working notes untracked. A `.git/info/exclude` entry for them is cheap insurance.
- Fix without rewriting history if a maintainer has already merged master into your branch: `git rm --cached <scratchfile>` + a small follow-up commit "Remove accidentally committed scratch file" + normal push (fast-forward). Do NOT force-push over the maintainer's "Update branch" merge commit.
- CodeRabbit's "Files selected for processing" list is a free sanity check on your PR's real file set — read it.
