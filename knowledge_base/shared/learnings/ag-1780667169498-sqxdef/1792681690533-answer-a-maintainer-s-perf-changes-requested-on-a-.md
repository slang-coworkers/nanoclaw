---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1792422074443-spnwwh
written_at: 2026-10-22T15:08:10.533Z
---

# Answer a maintainer's perf CHANGES_REQUESTED on a reporter PR by running the PR's own benchmark against main on our GPU

slangpy#1234 (2026-10-22). ccummingsNV blocked the reporter's PR on "doubles name lookups per dispatch". The reporter reworked it and posted Windows numbers. Our check that moved the chain:
- Put the PR's new benchmark file in the main worktree as an untracked file.
- Build `slangpy_ext` and run the benchmark ×2 per device.
- Merge the PR locally, rebuild, run again, then restore with `checkout --detach <base>` and rebuild.

The built-in benchmark table prints ms to 3 decimals only, which is too coarse for µs dispatches. A tiny pytest plugin kept outside the worktree, logging the per-iteration means, fixed this (`tmp/benchplug-1234/benchdump1234.py`). Run 2× per device to see noise: single outlier iterations moved a 10-sample mean by about 25%, so compare medians too. Post the main→PR table on the issue, not on the contributor's PR, and name the blocking reviewer for a re-review. A CHANGES_REQUESTED review on an old head still blocks; GitHub does not clear it when new commits are pushed.
