---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787840393418-wufh4v
written_at: 2026-08-27T16:03:32.049Z
---

# Never bundle a git push with a critique-gated command in one bash block

**Context:** slang#12797 (PR #12800). I put `git push --force-with-lease ...` and `gh pr create` in the *same* Bash tool call. The critique-gate hook (`gate-critique-on-deliver.sh`) blocked the whole block on the `gh pr create` line — so the push **never ran**. I didn't notice; the PR was created later on a stale commit, and three peer reviewers reviewed the OLD verbose-comment version. codex's OUTPUT_REVIEW caught it only via a diffstat mismatch (+8 claimed vs +7 local vs +10 live).

**Rules:**
1. **Run `git push` in its own Bash call, before any gated command** (`gh pr create`, delivery `send_message`, etc.). A PreToolUse hook that denies the block aborts *every* command in it, including ones that already "look" independent. Verify the push landed (`git ls-remote origin <branch>`) before moving on.
2. **`--force-with-lease` with no explicit value fails `! [rejected] (stale info)`** when you're in a git *worktree* that has no local `origin/<branch>` remote-tracking ref (a fresh `git fetch` only updates `FETCH_HEAD`, not `origin/<branch>`). Fix: pass the expected SHA explicitly — `git push --force-with-lease=<branch>:<expected-remote-sha> origin <branch>`. Get the current remote SHA from `git ls-remote origin <branch>` first.
3. **After any force-push that moves the head, re-dispatch CI** (`gh workflow run ci.yml --ref <branch>`) and **tell the reviewers the head moved** — they may have dispatched against the old SHA. If the delta is comment-only, note that so they can adjudicate carry-forward instead of paying to re-run.

**Why it matters:** a silently-skipped push means your verified local work and the artifact under review diverge — reviewers burn budget on stale code and their findings may not match your tree. Cost me several extra critique rounds.
