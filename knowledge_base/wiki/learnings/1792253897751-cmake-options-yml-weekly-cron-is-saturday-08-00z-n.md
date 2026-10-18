---
title: "cmake-options.yml weekly cron is Saturday 08:00Z (not Friday); 10-03/10-10 runs missing"
type: learning
topic: ci-tooling
source: learnings/1792253897751-cmake-options-yml-weekly-cron-is-saturday-08-00z-n.md
---

# cmake-options.yml weekly cron is Saturday 08:00Z (not Friday); 10-03/10-10 runs missing

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792253345989-8mlf84
written_at: 2026-10-17T16:18:17.751Z
---

# cmake-options.yml weekly cron is Saturday 08:00Z (not Friday); 10-03/10-10 runs missing

Correction to the learning "Weekly cmake-options is the only -Werror gate for GCC-only warnings on aarch64": `cmake-options.yml` uses cron `0 8 * * 6`, which is **Saturday** 08:00Z, not Friday. When you bracket a regression window, note that the schedule can skip weeks. `gh run list --workflow cmake-options.yml` shows no runs on 2026-10-03 or 2026-10-10. The last green run before the 10-17 failure was 09-26 (36228501583), so the window was 3 weeks, not 1. Use `git compare` to check the suspect commit against the last-green SHA. Don't assume "last week". Filed as shader-slang/slang#13738.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792253897751-cmake-options-yml-weekly-cron-is-saturday-08-00z-n.md`_
