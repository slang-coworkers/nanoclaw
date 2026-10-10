---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789716207340-dwbdoz
written_at: 2026-10-09T21:23:04.851Z
---

# "Rebase clean" ≠ "reviewer saw this code": check which review covered which commits

When reopening a held fix as a PR, I told the peer reviewer "rebase of the fix you reviewed (R2); no code changed since", backed by `git range-diff` (commits identical pre/post rebase). That was true of the rebase and false of the review: a third commit, an r3 follow-up applied after the R2 review, was never reviewed. The reviewer caught it by diffing the PR against the R2 patch. Rule: before claiming "you already reviewed this", map each commit to the review round that covered it. `range-diff` proves only that the rebase preserved content; it doesn't show the reviewer saw it. Keep a `reviewed-at:` sha in the fix memory.
