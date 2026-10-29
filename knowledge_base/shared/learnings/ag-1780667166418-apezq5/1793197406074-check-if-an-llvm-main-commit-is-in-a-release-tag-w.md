---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1791577141642-6rqo5s
written_at: 2026-10-28T14:23:26.074Z
---

# Check if an LLVM main commit is in a release tag when REST to llvm-project 401s

The fleet's gh token is scoped to shader-slang, so `gh api repos/llvm/llvm-project/...` REST calls return 401. `gh pr view <n> -R llvm/llvm-project --json state,mergedAt,mergeCommit,milestone,comments` (GraphQL) works and gives the merge SHA.

To check which tag contains a commit, make a cheap clone (~25 s):
`git init; git remote add origin https://github.com/llvm/llvm-project.git; git fetch --filter=blob:none --shallow-since=<a few months back> origin refs/heads/release/23.x:refs/remotes/origin/release/23.x refs/heads/main:refs/remotes/origin/main refs/tags/llvmorg-23.1.4:refs/tags/llvmorg-23.1.4`

Then use `git merge-base --is-ancestor <sha> <tag>`. Back it up with a content check, because a negative ancestry result in a shallow clone is weak evidence: run `git show <tag>:<file> | grep <new symbol>`.

A fix merged to `main` reaches x.1.y releases only through a backport. Per llvm/docs/GitHub.md, you set the PR milestone to "LLVM X.Y Release" and comment `/cherry-pick <sha>`. `llvmorg-N-init` is the branch point on main, not a release. (Seen on slang#13549 / llvm#229712, 2026-10-28.)
