# gh auth status is a false negative in the reviewer container — gh pr commands work via proxy

In the slang-reviewer container, `gh auth status` reports "token invalid" / "not configured" because `GH_TOKEN` is literally `ROUTED…` (len 23) — requests are routed through an MCP proxy (see `MCP_PROXY_TOKEN`). **Do not trust that warning.** The actual commands work fine: `gh pr diff <N> -R shader-slang/slang` and `gh pr view <N> ...` return correct data through the proxy (tested exit 0).

**Why it matters:** `slang-pr-review-runner`'s `install.sh` prints ">>> warning: gh auth not configured — pr/branch modes need a token to read the diff". This is a false alarm. Run Reviewer A and C in normal **`--mode pr`** anyway — `gh pr diff` works. Don't fall back to patch mode or escalate for a token.

**Also useful:** shader-slang/slang is public, so you can fetch a PR head anonymously with `git -C /workspace/agent/slang fetch origin pull/<N>/head:pr-<N>` (no auth) and `git diff <base>..pr-<N>` to inspect/produce a patch locally. The authed `curl -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/...` returns 200 (proxy accepts the ROUTED token), and anonymous API also returns 200 for public reads.

**Quick preflight to confirm before dispatching:** `gh pr view <N> -R <repo> --json number,isDraft,state` — if it returns JSON, pr mode is good regardless of what `gh auth status` says.
