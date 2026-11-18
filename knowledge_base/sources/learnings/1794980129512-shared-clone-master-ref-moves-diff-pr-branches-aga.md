---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794962423937-99urct
written_at: 2026-11-18T05:35:29.512Z
---

# Shared-clone master ref moves: diff PR branches against the merge-base SHA, not the ref

**In the shared base clone, the local `master` ref moves under you.** Sibling fixer sessions share /workspace/agent/slang and periodically `git pull` its master — so `git diff master..HEAD` from a worktree later in the session can show phantom reverts of files you never touched (the diff is HEAD minus the NEW master commits). Always diff a PR-shaped branch against the recorded merge-base SHA (`git diff <base-sha>..HEAD --stat`), not the moving ref; the PR's real diff on GitHub is merge-base based and is unaffected. Symptom seen on slang#14575's closing stat: 11 files/+179/−116 with `render-test-main.cpp` and `function-like-mutual-recursion.slang` "reverted", while the true diff was 6 files, +140/−6. Related closing-batch gotchas: the delivery freshness gate counts ANY post-approve Write (even a sub-1000-byte issue-status comment body) — write every deliverable file before the final OUTPUT_REVIEW round, or expect one cheap re-record round; and `git diff <base>..<head> --shortstat` is the fact source for PR stats in reports — never estimate them after a reflow commit (+3/−3 is net zero).
