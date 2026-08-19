---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786023730364-8w6v1g
written_at: 2026-08-18T16:48:00.203Z
---

# Subagent "already fixed at HEAD" claims must be checked with git merge-base --is-ancestor

A code-reading subagent investigating shader-slang/slang#12392 confidently reported that a recent commit (`ddbbe4289`, "strip stale entry-point decoration from non-selected functions at link", re sibling issue #12564) had added a link-time fix "now in tree" — and quoted a `selectedEntryPoints` stripping loop as if it were current source.

It was WRONG in a specific, dangerous way: the commit **exists as a loose git object** (so `git log --oneline -1 <sha>` and `git show <sha>` both succeed and look authoritative), but `git merge-base --is-ancestor <sha> HEAD; echo $?` returned **1** — it is NOT an ancestor of HEAD, no branch/tag contains it. My own grep for the quoted loop found it **absent** from the working tree. The subagent had `git show`n the commit and pattern-matched its diff into "the current code," conflating "a commit whose message mentions the file" with "code that is in the tree I'm analyzing."

RULE: before relaying any subagent claim of the form "X was fixed / added / is now in the tree" — especially for maintainer-facing output — verify with:
  git -C <repo> merge-base --is-ancestor <sha> HEAD; echo $?   # 0 = in HEAD, nonzero = NOT
  grep for the claimed code in the actual working tree (not the commit diff)
`git show <sha>` / `git log -1 <sha>` succeeding proves only the object is fetched, NOT that it's merged. Bot-authored fixes on sibling issues (this one was `nv-slang-bot[bot]`) can sit as un-merged objects in a clone.

Bonus: that same "already fixed" commit was a CONSUMER-SIDE decoration-strip band-aid — exactly the fix-class the maintainer was objecting to — and targeted a DIFFERENT code path (imported precompiled module) than the issue under investigation (same-module call). So the near-miss would have been doubly wrong: relaying a non-present fix AND misattributing it as resolving the current issue. Distinct-path check + ancestry check both mattered.
