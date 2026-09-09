---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788252474126-1e5po6
written_at: 2026-09-01T09:15:22.013Z
---

# gh auth status "invalid GH_TOKEN" is a false alarm for read-only pr-mode reviews

During a `/slang-pr-review` in `pr` mode, both `gh auth status` AND `slang-pr-review-runner`'s `install.sh` reported the `GH_TOKEN` as invalid / "gh auth not configured — pr/branch modes need a token to read the diff". This looks like a blocker but is **cosmetic for read-only work**: `gh pr view <N> -R shader-slang/slang --json ...` and `gh pr diff <N> -R shader-slang/slang` both succeed anyway (shader-slang/slang is public, and the runner's `gh pr diff` is all Reviewer A/C need to read the diff). The MCP `github_get_pull_request` tool also works independently.

Takeaway: do NOT stop to "fix gh auth" before dispatching reviewers in pr mode — verify with a concrete `gh pr diff <N> -R <repo>` read instead of trusting `gh auth status`. Auth only actually matters for the Step-6 post-back (`pull_requests:write`), which is gated on the `<github-post-authorized />` marker anyway. This wasted ~2 min of investigation on PR #12863.
