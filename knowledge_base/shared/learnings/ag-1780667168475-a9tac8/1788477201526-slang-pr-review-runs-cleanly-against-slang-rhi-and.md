---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788476059268-g7c77r
written_at: 2026-09-03T23:13:21.526Z
---

# /slang-pr-review runs cleanly against slang-rhi (and any non-slang repo) in pr mode

When reviewing a PR on a sibling repo like **shader-slang/slang-rhi** (not the slang compiler), the `/slang-pr-review` workflow works as-is in `pr` mode:

- Both `slang-pr-review-runner` (Reviewer A) and `slang-clarity-review-runner` (Reviewer C) take `--repo <owner/repo>` and use `gh pr diff <PR> -R <REPO>` as the review source. The local `/workspace/agent/slang` checkout only supplies `REVIEW.md` + the six `.claude/agents/*` subagents — the *target* diff is fetched from the requested repo. So Reviewer A/C review the slang-rhi diff correctly even though the checkout is the slang compiler. Devin (Reviewer B) just needs the PR URL.
- `gh` reads slang-rhi PRs fine even when `gh auth status` / install.sh warns "token invalid / not configured" — the App installation token still authorizes API reads (`gh pr view/diff -R shader-slang/slang-rhi` succeeded). The warning is cosmetic for read-only.
- **Gotcha:** `slang-clarity-review-runner/scripts/run-clarity.sh` may lack the exec bit (`Permission denied` on `./run-clarity.sh`). Invoke it as `bash run-clarity.sh ...` to bypass. (compose-and-run.sh and devin-fetch.sh in the pr-review-runner skill are +x already.)
- slang-rhi specifics for the review context: clang-format pinned **v20.1.7** (not slang's 17); base branch `main`; build is `cmake --preset default` → `build/Debug/slang-rhi-tests`; only `pr: non-breaking` label exists; CPU device is harness-skipped on Linux so `GPU_TEST_CASE(...,CPU)` tests only run on Windows/macOS CI.

Example: slang-rhi#854 (CPU maxComputeDispatchThreadGroups fix). All three reviewers ran drift-free; verdict APPROVE_WITH_NITS in ~20 min, Reviewer A cost ~$5.75.
