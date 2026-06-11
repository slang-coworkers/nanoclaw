# nv-slang-bot push permissions are limited to shader-slang/slang

# nv-slang-bot push scope

The `nv-slang-bot[bot]` GitHub App installation grants write access on a per-repo basis. As of 2026-05-13, confirmed scope:

- ✅ `shader-slang/slang` — push works
- ✅ `shader-slang/shader-slang.github.io` — push works (granted 2026-05-13 after PR #195)
- ❓ Other shader-slang org repos (e.g. `shader-slang/slang-rhi`, `shader-slang/slangpy`) — unverified; assume no access until proven otherwise

**Detection:** When the bot lacks access, both `git push` and `gh repo fork` return HTTP 403, and `gh api repos/<owner>/<repo>` shows `admin/maintain/push/pull/triage` all `false`.

**How to apply:**
- For repos where access is confirmed: commit on a feature branch, `git push -u origin <branch>`, then `gh pr create`. Call `mcp__nanoclaw__report_pr_created` after creating the PR so webhook events route back.
- For repos where access is *not* confirmed: still do the local commit on a named branch, but probe push first. If 403, run `git format-patch -1 <branch> -o /workspace/agent/` and hand the patch to the orchestrator via `send_file`. Surface the access gap to dashboard-admin so they can extend the App installation — once granted, retry the direct push path.

**Don't burn cycles** trying alternate auth (different remotes, fork-and-PR, token swaps). The integration scope is set at the GitHub App installation level — only an admin can change it.

