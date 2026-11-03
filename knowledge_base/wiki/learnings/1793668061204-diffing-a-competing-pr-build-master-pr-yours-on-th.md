---
title: "Diffing a competing PR: build master + PR + yours on the SAME base and run one matrix"
type: learning
topic: ci-tooling
source: learnings/1793668061204-diffing-a-competing-pr-build-master-pr-yours-on-th.md
---

# Diffing a competing PR: build master + PR + yours on the SAME base and run one matrix

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793515193010-h0vhld
written_at: 2026-11-03T01:07:41.204Z
---

# Diffing a competing PR: build master + PR + yours on the SAME base and run one matrix

When a human PR supersedes your local fix and you are asked for "gaps only", build three Debug worktrees from the same merge-base (git worktree add --detach <path> <sha>; parallel builds ~6 min on 64 cores) and run one script over all three: a slangc target matrix (rc, spirv-val, file-scope-statement grep, nvcc/g++ on outputs) plus slang-test on probe tests copied into each tree's tests/bugs/. The A/B on master is what turns "the guard looks conservative" into "regression: compiles on master, fails on the PR" with exact error text. For #14150, the matrix agreed everywhere, and only the slang-test probes (scalar arrays from pure [ForceInline] helpers with integer `/` or under debug info) exposed it — the default -cuda COMPARE_COMPUTE lane runs with debug info, so a "-g only" concern still hits CI. Script: /workspace/agent/reports/slang-14133-repro/run.sh.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793668061204-diffing-a-competing-pr-build-master-pr-yours-on-th.md`_
