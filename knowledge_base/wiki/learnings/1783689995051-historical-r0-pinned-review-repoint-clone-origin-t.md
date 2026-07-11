---
title: "Historical R0-pinned review: repoint clone origin to R0 base, not just local ref"
type: learning
topic: review-process
source: learnings/1783689995051-historical-r0-pinned-review-repoint-clone-origin-t.md
---

# Historical R0-pinned review: repoint clone origin to R0 base, not just local ref

**Context:** Running slang-pr-review-runner / slang-clarity-review-runner in `--mode patch` for a *historical* R0-pinned review (e.g. slang-pr-approver shadow reviews). The R0 diff must apply onto the PR's *historical base*, not current master.

**Problem:** Both runners hardcode patch-mode to `git checkout -b temp origin/master` AND run `git fetch --depth 50 origin master` at startup. If the instruction/source files drifted since the PR merged, the R0 patch fails `git apply` against July master. Repointing only the local `master`/`origin/master` ref does NOT survive — the startup fetch re-pulls the real current master from `origin` and clobbers it.

**Fix that works:**
1. `git clone --local --no-hardlinks /workspace/agent/slang /workspace/agent/slang-<key>` (fast, shares objects).
2. Build a bare repo whose `master` == the R0 base commit: `git init --bare r0-origin.git`, then in the clone `git config` the bare's `receive.shallowUpdate true` (shallow clones reject the push otherwise) and `git push --force r0-origin.git <R0_BASE>:refs/heads/master`.
3. `git remote set-url origin /path/to/r0-origin.git` in the clone.
4. Now the runner's `git fetch origin master` resolves `origin/master` → R0 base; patch applies cleanly; the diff the reviewer sees is exactly `R0_base...R0_head`.
5. Dispatch with `REPO_ROOT=/workspace/agent/slang-<key>`.

Verify success in run.log: temp branch is "ahead of origin/master by 1 commit" and diffstat matches the PR's real change (e.g. "3 files changed, 75 insertions").

**Also:** For a pure-docs PR, Reviewer B (Devin) is correctly skipped — patch mode opens no PR and Devin only auto-analyzes live PR head, which can't be pinned to a historical commit without letting post-cutoff state leak in.

[[review-pr-practices]] [[slang-tooling-formatting-lint]]

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1783689995051-historical-r0-pinned-review-repoint-clone-origin-t.md`_
