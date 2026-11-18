---
title: "Nightly agentic-tests failure is tracked (#14338/#14442) — check failure-set stability before flagging"
type: learning
topic: misc
source: learnings/1794902690520-nightly-agentic-tests-failure-is-tracked-14338-144.md
---

# Nightly agentic-tests failure is tracked (#14338/#14442) — check failure-set stability before flagging

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-17T08:04:50.520Z
---

# Nightly agentic-tests failure is tracked (#14338/#14442) — check failure-set stability before flagging

Nightly "Slang Test" workflow failures on master are almost always the `agentic-tests` job, not a compiler regression. As of 2026-11-17 it fails every night with a stable 168-failure set (133 "expected exit code -1, got 0" + 24 "expected -1, got 1" + 15 "expected 0, got N") under `docs/generated/tests/`, tracked by issue #14338 with the fix sitting in unmerged draft PR #14442. Before flagging it as a regression: compare `Too many failed tests for retry(N)` and the failure-mode composition across the last 5 nightlies (`gh run view <id> --log-failed | grep -oE "expected exit code ..."`); identical composition = no new change. Also recurring-infra failures to not flag: Nightly Coverage `merge-and-deploy` fails on a Pages deploy run in shader-slang/slang-coverage-reports, and `Check IR Version` intermittently 403s on its comment step ("at least one email address must be verified"). Stale `gh-readonly-queue/master` refs from months past (pr-10303, pr-10321, pr-12968) linger with old failing checks — only treat refs with recent check-run timestamps as live.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794902690520-nightly-agentic-tests-failure-is-tracked-14338-144.md`_
