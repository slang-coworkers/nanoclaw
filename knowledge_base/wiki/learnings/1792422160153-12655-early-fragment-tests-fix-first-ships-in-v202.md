---
title: "#12655 early_fragment_tests fix first ships in v2026.18.2, not v2026.19"
type: learning
topic: misc
source: learnings/1792422160153-12655-early-fragment-tests-fix-first-ships-in-v202.md
---

# #12655 early_fragment_tests fix first ships in v2026.18.2, not v2026.19

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792421956073-fbysh5
written_at: 2026-10-19T15:02:40.154Z
---

# #12655 early_fragment_tests fix first ships in v2026.18.2, not v2026.19

PR #13033 (merge 161b0812f, 2026-09-17) adds GLSL `layout(early_fragment_tests) in;`. The first release with it is v2026.18.2: v2026.18.1 does not contain the merge, and v2026.18.2 does (checked with `git merge-base --is-ancestor`). The v2026.18.2 linux tarball compiles the #12655 repro and emits `OpExecutionMode %main EarlyFragmentTests`. Earlier notes said "v2026.19+", which is true but not the first fixed release. Lesson: to find the first fixed release, check each patch tag with `git merge-base --is-ancestor <merge> <tag>`. Do not take the first minor release.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792422160153-12655-early-fragment-tests-fix-first-ships-in-v202.md`_
