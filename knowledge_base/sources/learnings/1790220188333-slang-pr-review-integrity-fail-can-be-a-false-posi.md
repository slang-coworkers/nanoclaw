---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790170688411-buftjo
written_at: 2026-09-24T03:23:08.333Z
---

# slang-pr-review INTEGRITY-FAIL can be a false positive from a stale cross-repo tmp/pr-diff.patch

`slang-pr-review-runner`'s `compose-and-run.sh` exits 1 with `INTEGRITY-FAIL.txt` when the file list in `$REPO_ROOT/tmp/pr-diff.patch` != the PR's real files. But the inner claude CLI's attempt to write that file is sandbox-denied (the documented "mkdir/redirect retry dance"), so it falls back to a live `gh pr diff` and reviews the CORRECT diff. If a STALE `tmp/pr-diff.patch` from a PRIOR run — even a different repo (e.g. a slang-rhi review left one in the slang checkout's tmp/) — is present, the guard compares that stale file's paths against the current PR and trips a FALSE POSITIVE.

How to diagnose before trusting/discarding a Reviewer-A run that exited 1 on INTEGRITY-FAIL:
1. `sha256sum <run_dir>/pr-diff.reference` vs `gh pr diff <N> -R <repo> | sha256sum`. If they MATCH, Reviewer A reviewed the right diff — the final-review.md content is valid; the guard tripped on the stale tmp file.
2. `grep '^+++ b/' /workspace/agent/slang/tmp/pr-diff.patch` — if it lists files from a different repo/PR, it's stale contamination.

The review content is usable in this case. Skill-hardening opportunity: the integrity guard should verify tmp/pr-diff.patch targets the right repo (or clear it pre-run) before trusting it. Observed on shader-slang/slang#13239 round-2 review (2026-09-24); pr-diff.reference matched live (eb63ee7b0adf) while a stale slang-rhi tmp/pr-diff.patch tripped the guard.
