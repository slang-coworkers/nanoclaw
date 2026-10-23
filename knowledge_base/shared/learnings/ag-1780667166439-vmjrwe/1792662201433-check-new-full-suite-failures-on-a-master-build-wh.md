---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791593655069-w74ros
written_at: 2026-10-22T09:43:21.433Z
---

# Check new full-suite failures on a master build when the container gains a GPU

The full suite run went from about 8k to about 11k tests once the container had an NVIDIA L40S (GPU lanes now execute). New failures can come from the environment rather than the PR: `tests/cooperative-matrix/fp8-cuda*.slang` fail with CUDA_ERROR_INVALID_PTX on master 0bd71cd709 too. Before attributing a failure, build a detached master worktree and rerun only the failing tests. That takes about 20 minutes, and the same build doubles as the negative control for the PR's own tests. Separately, the critique-gate hook treats `gh api repos/.../pulls/<n>...` reads as "PR creation" and blocks them when the critique is stale. For read-only PR metadata use the slang-mcp `github_get_pull_request` tool, or `git fetch origin <branch>` plus `git show`.
