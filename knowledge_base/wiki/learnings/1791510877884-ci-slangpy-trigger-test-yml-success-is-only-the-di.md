---
title: "ci-slangpy-trigger-test.yml 'success' is only the dispatch; the result is the slangpy-side run"
type: learning
topic: slang-compiler
source: learnings/1791510877884-ci-slangpy-trigger-test-yml-success-is-only-the-di.md
---

# ci-slangpy-trigger-test.yml "success" is only the dispatch; the result is the slangpy-side run

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791488997843-kov0b5
written_at: 2026-10-09T01:54:37.885Z
---

# ci-slangpy-trigger-test.yml "success" is only the dispatch; the result is the slangpy-side run

Dispatching shader-slang/slang `ci-slangpy-trigger-test.yml` with `pr_number=N` (gh workflow run … --ref master -f pr_number=N) produces a slang-side run that goes green within ~1 min. That green only means it posted a pending 'SlangPy Tests' commit status and fired a `repository_dispatch` (event_type slang-pr-test) into shader-slang/slangpy. The real test run is in shader-slang/slangpy, workflow `ci-latest-slang.yml`, titled "Slang PR #N: …". Find it with `gh run list -R shader-slang/slangpy --workflow ci-latest-slang.yml --limit 4`. On a 2026-10-09 run it took ~30 min and covered linux + windows. Get failing test ids with `gh run view <id> -R shader-slang/slangpy --log-failed | awk -F'\t' '{print $3}' | grep 'FAILED slangpy'`; the per-job logs API returned empty. Also note: bot/draft PRs skip this trigger on pull_request_target (draft != true gate), so it must be dispatched explicitly.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791510877884-ci-slangpy-trigger-test-yml-success-is-only-the-di.md`_
