---
title: "Before executing a 'land this patch' dispatch, check the PR doesn't already exist"
type: learning
topic: misc
source: learnings/1780769347490-before-executing-a-land-this-patch-dispatch-check-.md
---

# Before executing a "land this patch" dispatch, check the PR doesn't already exist

**Rule:** When a parent/triage dispatch says "land the verified patch for issue #N as a draft PR," the FIRST action is to check whether a PR / fix branch already exists — not to start branching/pushing. Stale upstream context produces no-op re-dispatches of already-completed work.

**Concrete check (cheap, do it first):**
```bash
gh pr list --repo <owner>/<repo> --head fix/issue-<N> --state all --json number,state,isDraft,url
# or, if you suspect a PR number from memory:
gh pr view <num> --repo <owner>/<repo> --json state,isDraft,headRefName,number
ls -la /workspace/agent/active-work/slang-<N>/      # sentinel from a prior session
cat /workspace/agent/memory/fix-<N>.md              # prior-run record
```

**Why:** 2026-06-06, slang#11487. Parent dispatched "land your verified patch as a draft PR" with a warning about a "fork-push permissions blocker." Investigation showed PR #11492 had been opened the *previous day* (2026-06-05), branch `fix/issue-11487` already on `origin`, CI all-green, and a maintainer had already promoted it draft→ready. The dispatch was a complete no-op land — the parent's context was stale and the fork-push framing was obsolete (this bot has direct push rights to `origin = shader-slang/slang`; no fork needed). Acting on the dispatch literally (branch + push + open) would have created a duplicate PR.

**Two corollaries from the same chain:**

1. **Maintainer-initiated draft→ready is NOT a drafts-only violation for the bot to revert.** The drafts-only guardrail binds the *bot's own actions* (the bot must open PRs as draft and never self-`gh pr ready`/merge). When a *maintainer* (here `szihs`) flips the PR ready-for-review and requests a reviewer, that is their authorization — surface it for awareness in the upstream report, but do NOT revert the state. Reverting a maintainer's explicit action would be the actual error.

2. **The "fork-push blocker" framing is stale guidance.** `/slang-fix-issue` Step 7's "push to a fork" wording was written for unprivileged actors. `nv-slang-bot[bot]` pushes `fix/issue-<n>` directly to `origin = shader-slang/slang` (confirmed: `git push origin fix/issue-<n>` succeeds first try). If a dispatch warns about fork-push as the expected blocker, treat it as likely-stale and verify push rights with `git ls-remote origin` / `git push --dry-run` rather than reaching for a fork.

**How to apply:** On any "land/fix #N" dispatch, run the existence check above before any worktree/branch/push action. If the PR already exists and is in good shape, the chain close = (a) refresh `report_pr_created` so webhooks route to the current session, (b) A2A status-confirmation report to parent (label it "already-landed / no-op land," not a fresh fix), (c) this learning. Do not open a second PR.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780769347490-before-executing-a-land-this-patch-dispatch-check-.md`_
