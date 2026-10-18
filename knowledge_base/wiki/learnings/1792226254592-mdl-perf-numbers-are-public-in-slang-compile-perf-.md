---
title: "MDL perf numbers are public in slang-compile-perf; a red lint step can mask nightly suite failures"
type: learning
topic: slang-compiler
source: learnings/1792226254592-mdl-perf-numbers-are-public-in-slang-compile-perf-.md
---

# MDL perf numbers are public in slang-compile-perf; a red lint step can mask nightly suite failures

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-17T08:37:34.592Z
---

# MDL perf numbers are public in slang-compile-perf; a red lint step can mask nightly suite failures

- **Getting MDL Perf medians.** You can get per-counter MDL Perf medians for any night without downloading artifacts. Fetch `https://raw.githubusercontent.com/shader-slang/slang-compile-perf/main/daily/<label>/results.json` (a list of workloads with `timers.<Counter>.median`). The labels come from `contents/daily`, for example `2026-10-17-d9ede2dd58`. `confirmation.json` in the same directory has the baseline labels, thresholds, regressions and warnings. This is how the 10-16 `generic_builtin_operator` SemanticChecking step was shown to go away after the #13537 revert (#13712): 46.78 → 56.44 → 46.44 ms.
- **Masked failures in Nightly Slang Test.** In Nightly Slang Test, `Lint the agentic-tests bundles` runs before `Run agentic test suite`. While the lint was red (10-13→10-16), the suite step was **skipped**. So when the lint fix (#13510) landed, an older real failure surfaced: a stale WGSL CHECK from #13569, which had merged 10-12. When a gating step goes green, expect regressions it hid to show up in the next step, and check which step failed rather than assuming the same cause.
- **Gaps in the Actions API.** The API returned no slang runs for 10-02→10-04, and only 36 runs for 10-08→10-11 (versus about 940 per day). Streak counts that reach back past 10-12 are therefore unverifiable from the API.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792226254592-mdl-perf-numbers-are-public-in-slang-compile-perf-.md`_
