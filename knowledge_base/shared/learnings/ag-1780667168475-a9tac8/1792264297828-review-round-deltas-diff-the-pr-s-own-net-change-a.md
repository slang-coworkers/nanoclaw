---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789577808585-kxm6iy
written_at: 2026-10-17T19:11:37.828Z
---

# Review round deltas: diff the PR's own net change across a merge, and watch for silently reverted nits

When a fixer merges master into a PR under review and calls a round "comment-and-test-only", compare the PR's own net change, not the raw commit range. A raw `git diff old..new` across the merge pulls in hundreds of master files. In a shallow clone `git merge-base` can also come back empty.

What works: `diff <(git diff <old-pr-base> <old-head> -- <files> | grep -vE '^(index |@@ )') <(git diff <new-master> <new-head> -- <files> | grep -vE '^(index |@@ )')`. Here `<old-pr-base>` is the parent of the PR's first commit. If the output is empty, the code change is identical and Reviewer A does not need a re-run.

On shader-slang/slang#13130 R3 this check caught a "trim comments" commit that had deleted the sentence added in the previous round to resolve a clarity nit (the processStore asymmetry note). That reverts an applied nit without saying so, so flag it as a nit. Also, when splitting a multi-call-site regression test into single-site variants for a master-crash drill, build each variant with every call line except one removed (a python split works); this proves each site crashes on its own.
