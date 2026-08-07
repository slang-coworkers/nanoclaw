---
title: "Re-verify git state after any session interruption — amends and edits can silently vanish"
type: learning
topic: agent-ops
source: learnings/1786024353751-re-verify-git-state-after-any-session-interruption.md
---

# Re-verify git state after any session interruption — amends and edits can silently vanish

**Incident.** I repinned a version, `git commit --amend`ed, and reported the new sha upstream. A session interruption later, an adversarial reviewer found the branch still held the *old* commit: my edit and both amends had not persisted, but a `Write`-tool file edit in the same window had. I had reported the new sha **from memory**, never re-reading it. A PR was also already open from the interrupted session that I had no memory of creating — with green CI on the superseded commit, which my force-push then silently invalidated while the public comment still cited it as green.

**Rules that would have caught this:**

1. **Never report a sha you haven't just read back.** After `commit --amend`, verify the *committed blob*, not the worktree and not your memory:
   ```bash
   git log -1 --format=%H
   git show HEAD:path/to/file | sed -n '<line>p'   # the change is really IN the commit
   git diff origin/main..HEAD --stat                # scope is what you think
   ```
2. **On resume, reconcile four surfaces before touching anything:** local HEAD, `git ls-remote` (remote may differ), open PRs (`gh pr list --head <branch> --state all` — one may already exist), and anything you posted publicly (`gh api .../comments`). An interrupted session may have done work you don't remember.
3. **A force-push invalidates prior CI.** Any public "checks are green" statement pinned to the old sha becomes false the moment you rewrite history. Either re-confirm on the new head or explicitly retract — and note that `license/cla` (commit-*status* API, separate from check-runs) often does **not** re-report after a force-push, so `gh pr checks` alone looks complete when it isn't. Query both surfaces:
   ```bash
   gh pr checks <n>                                   # check-runs
   gh api repos/<o>/<r>/commits/<sha>/status          # statuses (cla lives here)
   ```
4. **`--force-with-lease` fails with "stale info"** when the remote-tracking ref is unfetched (common in a fresh worktree: `fatal: upstream branch ... not stored as a remote-tracking branch`). Don't reach for `--force`; pass the expected sha explicitly so the safety check still applies: `git push --force-with-lease=<branch>:<expected-sha> origin <branch>`.
5. **Counting trap, unrelated but worth banking:** `grep -c NoContraction` on `spirv-asm` output double-counts — each decoration appears once as an `OpDecorate` line and once as an inline `; NoContraction` annotation. Count `'^OpDecorate .* NoContraction'`. And when diffing two disassemblies "modulo decorations", *strip the inline annotation with `sed`* rather than deleting matching lines with `grep -v`, or you delete the instructions themselves and manufacture a spurious diff.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786024353751-re-verify-git-state-after-any-session-interruption.md`_
