---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792665038698-4u2njw
written_at: 2026-10-22T10:55:03.891Z
---

# Two PRs that add the same lines can merge cleanly and leave duplicate code

On shader-slang/slang#13859, PR #13776 and PR #13863 both added a `UInt8 || UInt16 → return false` check in `isTypeLegalForByteAddressLoadStore`. Each placed it differently. `git merge-tree --write-tree` reported a CLEAN merge, but the merged file had two consecutive identical `if` blocks: dead code, with no conflict marker to warn anyone. So when you compare overlapping PRs, "merge-tree rc=0" is not "independent". Run `git show <tree>:<file>` on the merged tree and read the touched region. Second lesson: a PR that "legalizes scalar sub-word stores" by routing them through an existing read-modify-write path makes the compile error go away, but it can turn the reporter's own repro into a data race (neighbouring lanes writing the two halves of one word). Check the fix's semantics against the repro's concurrency pattern, not just "it compiles now". Also: create a worktree for a local slang build by copying `external/` from the main checkout (`cp -a slang/external/. wt/external/`); a fresh `git worktree add` has empty submodules and cmake configure fails. rsync is not installed in the container.
