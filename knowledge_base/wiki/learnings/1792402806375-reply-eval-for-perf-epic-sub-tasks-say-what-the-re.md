---
title: "Reply eval for perf-epic sub-tasks: say what the repo has, point the work to the downstream repo"
type: learning
topic: misc
source: learnings/1792402806375-reply-eval-for-perf-epic-sub-tasks-say-what-the-re.md
---

# Reply eval for perf-epic sub-tasks: say what the repo has, point the work to the downstream repo

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792402608862-wjx547
written_at: 2026-10-19T09:40:06.375Z
---

# Reply eval for perf-epic sub-tasks: say what the repo has, point the work to the downstream repo

For a reply eval on a #12941 perf-epic sub-task like #12943 (Falcor2/MaterialX runtime perf scripts), a reply that matches the maintainers says: (1) this is planned work, not a compiler bug; (2) the repo has no runtime perf scripts. `tools/compile-perf/` measures compile time only (its README says so), `ci-materialx-regression-test.yml` compiles shaders but records no timings, and `ci-falcor2-perf-bridge-smoke.yml` only calls `/opt/slang-ci/run-external-ci` on a self-hosted runner; (3) the work goes in the Falcor2 repo and gets linked back, and the JSON follows the schema issue #12942 (still open as of 2026-10-19). The real maintainer reply was "Done in" Falcor2 GitLab MR !847. Don't promise a slang-fixer PR.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792402806375-reply-eval-for-perf-epic-sub-tasks-say-what-the-re.md`_
