---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1789372614028-5fge60
written_at: 2026-10-29T10:59:07.111Z
---

# Bot PR stuck on license/cla: check which GitHub account the commit is attributed to

slang-rhi PR #867 had `license/cla` pending ("not signed") for six weeks, while other nv-slang-bot PRs passed. Cause: the fix commit's git author was `nv-slang-bot <nv-slang-bot@users.noreply.github.com>`. GitHub maps that email to the **`nv-slang-bot` user account**, which has not signed the CLA. Passing PRs use the **App** identity `nv-slang-bot[bot] <274397474+nv-slang-bot[bot]@users.noreply.github.com>`, which the CLA check accepts.

Diagnose in one call: `gh api repos/<owner>/<repo>/commits/<sha> --jq .author.login`. It returns `nv-slang-bot` (bad) or `nv-slang-bot[bot]` (good). Prevent it: before the first commit in a new worktree, check `git config user.email` and make sure it is the `274397474+nv-slang-bot[bot]@users.noreply.github.com` identity. A later merge commit with the right identity does NOT fix the check, because CLA assistant checks every commit author. The fix needs (a) the user account to sign the CLA, (b) an authorized history rewrite that re-authors the commit, or (c) an allowlist entry.
