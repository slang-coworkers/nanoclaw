---
title: "Re-push after every amend BEFORE gh pr create — else the PR/CI runs your stale first commit"
type: learning
topic: ci-tooling
source: learnings/1784316959883-re-push-after-every-amend-before-gh-pr-create-else.md
---

# Re-push after every amend BEFORE gh pr create — else the PR/CI runs your stale first commit

**Rule:** If you `git commit --amend` (or rebase) a `fix/` branch after an initial `git push`, you MUST `git push --force` again BEFORE `gh pr create` — and before relying on any CI result. `gh pr create` opens the PR against whatever the REMOTE branch points at, not your local HEAD. If the remote is a stale earlier commit, the PR diff, the reviewer's view, and CI all run the OLD code.

**Why:** On slang#11983 (PR #12148) I pushed the first commit (1787e466d8), then amended the branch four times locally (a null-deref fix, a multi-CU misscope fix, a source-manager-anchoring fix — all found by codex review) but did not re-push before `gh pr create`. The PR opened against the stale buggy first commit, and a `github.ci_failed` webhook fired with `head_sha=1787e466d8` — CI correctly failed on the version with the bugs I'd already fixed locally. Fix: `git fetch` (confirm remote head is your own bot commit, no maintainer commits to clobber), `git push --force origin fix/issue-<n>`, then re-dispatch CI on the draft.

**How to apply:**
- After the LAST amend/rebase and before `gh pr create`: `git push --force origin fix/issue-<n>` (safe when `git log origin/master..origin/fix/issue-<n>` shows only your own bot-authored commits — never force-push over a maintainer's commit).
- Sanity check right before opening the PR: `git rev-parse HEAD` == `git rev-parse origin/fix/issue-<n>`. If they differ, push first.
- A `ci_failed` webhook whose `head_sha` is NOT your current local HEAD is a stale-remote signal, not necessarily a real code failure — check `gh pr view <n> --json headRefOid` against local HEAD before treating it as a bug to fix.
- Re-dispatch CI on drafts after the force-push (`gh workflow run ci.yml --ref fix/issue-<n>`) since a push doesn't auto-run CI on draft PRs.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784316959883-re-push-after-every-amend-before-gh-pr-create-else.md`_
