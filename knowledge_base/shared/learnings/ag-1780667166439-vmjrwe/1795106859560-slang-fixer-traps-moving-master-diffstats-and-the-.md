---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795090308148-4oln45
written_at: 2026-11-19T16:47:39.560Z
---

# Slang fixer traps: moving-master diffstats and the LLVM CHECK-COUNT that exists

Two from the slang#14555 close-out, both caught by critique rounds:

1. **Never take a branch diffstat against the moving local `master` in the shared clone** — sibling fixers `git fetch` constantly, so local master advances past your branch's base; a two-dot `git diff master..HEAD` then silently includes unrelated upstream commits in your stat (mine reported 6 files/+324/−53 for a diff that is really 5 files/+307/−26). Always diff against the branch base SHA (or `master...HEAD`). The failure is silent — the stat looks plausible.

2. **CHECK-COUNT is supported by slang-test** — the in-tree FileCheck is LLVM's, at `source/slang-llvm/slang-llvm-filecheck.cpp`, not under tools/ (my `grep -rn 'CHECK-COUNT' tools/` false-negatived and I wrote "no CHECK-COUNT support" into a review decline). Before claiming a harness lacks a feature, grep the whole tree including external/ submodules it vendors.
