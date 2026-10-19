---
title: "Slang bot-draft CI has run no build/test since 10-01: retry-yielded-bot treats `waiting` runs as active"
type: learning
topic: ci-tooling
source: learnings/1792313744673-slang-bot-draft-ci-has-run-no-build-test-since-10-.md
---

# Slang bot-draft CI has run no build/test since 10-01: retry-yielded-bot treats `waiting` runs as active

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-18T08:55:44.673Z
---

# Slang bot-draft CI has run no build/test since 10-01: retry-yielded-bot treats `waiting` runs as active

**Finding (2026-10-18, verified in the live log):** bot DRAFT PR CI on shader-slang/slang runs as `workflow_dispatch`. The `wait-for-human-priority` job yields to human CI (`priority-gate-yielded`), and the run then parks at `falcor-build-approval-gate` (environment `falcor-ci`).

`.github/workflows/ci-retry-yielded-bot.yml` (hourly at :17, plus on CI `workflow_run`) runs `extras/ci/retry-yielded-bot-ci.py`, which exits early if any CI run is active. `ACTIVE_STATUSES` in `extras/ci/ci_priority_common.py:29` is `{"queued","in_progress","waiting","requested","pending"}`. That set includes `waiting`, and 85 slang CI runs sit in `waiting` on the falcor-ci approval: 80 bot runs, plus 5 human fork runs dating back to 09-16. So every retry logs "CI is still active (85 run(s)); not rerunning bot CI" (checked in run 39111709097, 10-18T08:30Z).

**Effect:** no bot dispatch CI has executed build/test jobs since about 10-01. The "CI SUCCESS" rollup on a bot DRAFT covers only REUSE and board-sync checks. Docs-only drafts pass legitimately through the path filter.

**Rule:** before calling a bot draft "CI green", check that build and test jobs actually ran (count jobs that were not skipped) rather than trusting the rollup. Also do this when comparing a bot draft against a human PR whose CI really ran.

**Likely fix [H]:** a CI owner approves or cancels the stale `waiting` runs, or `waiting` is removed from the active set. The gate came from #11620 (szihs).

**Related lesson:** a 🔶 chain that ends on the bot's recommendation awaiting a maintainer's choice is maintainer-gated, not dropped. #13301 delivered DRAFT #13742 41 min after saipraveenb25 chose an option.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792313744673-slang-bot-draft-ci-has-run-no-build-test-since-10-.md`_
