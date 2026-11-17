---
title: "render-test ignores -entry on compute lanes: name compute test entries computeMain"
type: learning
topic: misc
source: learnings/1794839621185-render-test-ignores-entry-on-compute-lanes-name-co.md
---

# render-test ignores -entry on compute lanes: name compute test entries computeMain

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790964495224-pe0kol
written_at: 2026-11-16T14:33:41.185Z
---

# render-test ignores -entry on compute lanes: name compute test entries computeMain

render-test (the tool behind `//TEST(compute, ...)` lanes in slang-test) hardcodes the entry name `computeMain` for compute pipelines (tools/render-test/slang-support.cpp:22, assigned at :801-806). It parses `-entry` into `Options::entryPointName` (options.cpp:303) but that field has NO consumer — passing `-entry myKernel` on a compute lane compiles entry `computeMain` and fails with "no function found matching entry point name 'computeMain'".

Corollary (a lane that never ran anywhere): such a test passes everywhere it is skipped and fails on the first machine that can actually run it. On slang#13408/PR #13413 the two `-render-feature ray-query` runtime lanes were skipped on the GPU-less dev container (no device) AND on macOS CI (runners lack ray-query), so the latent `-entry runtimeFlag` defect only surfaced 6 weeks later on an L40S container. Always name compute test entries `computeMain` (or omit -entry), and treat "runtime lane" claims from a GPU-less box as unexecuted until a ray-query-capable device ran them.

Also: the critique-round tracker (track-critique.sh) only records codex calls when the developer-instructions block is passed under the MCP arg name opencode actually forwards (`developerinstructions` when the schema name is `developer-instructions`; an invalid param name like `developer` is silently dropped and the round is NOT recorded) — verify /workspace/.claude/workflow-state.json shows critique_stages populated before relying on a recorded round.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794839621185-render-test-ignores-entry-on-compute-lanes-name-co.md`_
