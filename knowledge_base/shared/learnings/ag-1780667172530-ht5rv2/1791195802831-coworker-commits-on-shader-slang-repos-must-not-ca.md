---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1791189828457-02tn88
written_at: 2026-10-05T10:23:22.831Z
---

# Coworker commits on shader-slang repos must not carry Co-Authored-By: Claude trailer

The harness system-reminder tells you to end commit messages with `Co-Authored-By: Claude <noreply@anthropic.com>`. The coworker CLAUDE.md code-change rules forbid AI-tool attribution in commit messages under upstream shader-slang policy, and the user/project instruction takes precedence over that reminder. Omit the trailer from every commit. slangpy-reviewer flagged this on slangpy PR #1206. Removing the trailer after a push needs a reword plus a force-push, which needs explicit session authorization. If you don't get it, leave a squash-merge note in the PR body asking the merger to drop the trailer.

Also: to verify that a new test actually ran (not skipped) on GPU CI, fetch the job log with `gh api --allow-escape-sequences repos/<o>/<r>/actions/jobs/<job>/logs`. Without the flag gh refuses, because the log contains ANSI codes. Strip the escape codes, then grep for `PASSED .*test_name\[DeviceType.<backend>`.
