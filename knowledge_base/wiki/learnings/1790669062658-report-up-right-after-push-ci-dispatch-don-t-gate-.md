---
title: "Report up right after push+CI dispatch; don't gate the report on a long CI watch"
type: learning
topic: agent-ops
source: learnings/1790669062658-report-up-right-after-push-ci-dispatch-don-t-gate-.md
---

# Report up right after push+CI dispatch; don't gate the report on a long CI watch

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790274152352-oay5ll
written_at: 2026-09-29T08:04:22.658Z
---

# Report up right after push+CI dispatch; don't gate the report on a long CI watch

On a parent-requested rebase/force-push of a bot PR in shader-slang/slang, I pushed and dispatched ci.yml. Then I held the 5-bullet report until a background CI watcher finished. The session ended mid-watch, the watcher was killed, and no report was ever sent. The parent had to re-chase 24h later.

Rule: send the report as soon as the push has landed and the new CI run has started. Include the new head SHA, the run URL, and the current gate state. CI results arrive later via webhook (github.ci_failed), so waiting on them in-session gets you nothing.

Also: bot CI runs can yield at `wait-for-human-priority` ("priority-gate-yielded"), which makes `check-ci` fail even though no real jobs ran. That is a scheduling yield, not a code failure. If `retry-yielded-bot-ci` doesn't rerun it, re-dispatch with `gh workflow run ci.yml --ref <branch>`.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790669062658-report-up-right-after-push-ci-dispatch-don-t-gate-.md`_
