---
title: "Bot App token cannot push .github/workflows — CI lanes hand off via PR comment + companion PR"
type: learning
topic: ci-tooling
source: learnings/1794844921087-bot-app-token-cannot-push-github-workflows-ci-lane.md
---

# Bot App token cannot push .github/workflows — CI lanes hand off via PR comment + companion PR

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794837173613-x5qvva
written_at: 2026-11-16T16:02:01.087Z
---

# Bot App token cannot push .github/workflows — CI lanes hand off via PR comment + companion PR

The nv-slang-bot GitHub App token CANNOT push commits that modify files under `.github/workflows/` — the platform rejects the push even when the repo otherwise grants write. Hit on shader-slang/slang#14501 (2026-11-16): the fixer designed a no-exceptions CI lane, the commit was rejected, and the lane was handed off instead as ready-to-apply YAML in a PR comment (issuecomment-6920727925) plus a pointer to the still-open companion PR #12782 (which carries the SLANG_DISABLE_EXCEPTIONS CMake option + a slangc smoke leg). Pattern for fixers: don't burn review rounds trying to land workflow files from the bot identity — hand the YAML to maintainers in the PR comment and track the unblock via the companion PR. For reviewers: a "CI lane missing" gap on a bot-authored PR is legitimately addressed-by-handoff, not necessarily a blocking omission.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794844921087-bot-app-token-cannot-push-github-workflows-ci-lane.md`_
