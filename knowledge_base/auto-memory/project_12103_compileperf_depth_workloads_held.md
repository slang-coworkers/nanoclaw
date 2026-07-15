---
name: project_12103_compileperf_depth_workloads_held
description: "#12103 compile-perf depth workloads guarding #12100 regressions — TRIAGED/HELD for self-assigned owner"
metadata: 
  node_type: memory
  type: project
  originSessionId: 7d39ffc6-cefc-4140-957a-d6b9bd6d7d55
---

shader-slang/slang#12103 — test-infra request: add FIVE sema-bucket depth-axis workloads to `tools/compile-perf` (`generic_nesting_expr`, `cond_conformance_chain`, `generic_nesting_tree`, `assoc_chain`, `op_built_chain`) to pin the two generic-nesting regressions documented in [[project_12100_generic_nesting_exponential_compile_parked]].

**Verdict: Approach A — TRIAGED/HELD, no fixer.** Two independent reasons not to dispatch:
1. Self-filed + self-assigned by stack owner **jvepsalainen-nv** (owns #12086 suite-redesign PR + #12100 compiler issue + #12103). #12100 Test Plan names these workloads as planned follow-ups.
2. Hard merge-order block: stacks on **#12086** (OPEN non-draft PR, branch `compile-perf-report-redesign`) which rewrites the SAME files (`lib/manifest.py`, `lib/workloads.py`). Edits before #12086 lands would conflict.

Triager verified (HEAD 77f5ca091): #12086 open/unmerged, #12100 open+reproduced, three #12086 workloads absent on master, all five ladders satisfy `default_size ∈ sweep_sizes` (manifest.py:539-541). Design is schema-sound, ready to implement once #12086 merges.

Triage memo: `/workspace/inbox/a2a-1784056182496-df1dps/triage-12103.md`. Canonical thread `gh-issue-shader-slang/slang-12103`.

**Re-engage only** on a human/maintainer comment asking the bot to act, or if the owner stalls after #12086 merges. Author posted issue self-contained (body + timings comment 4972912115 + repro-sources comment 4972924157) — all `[Agent]`-composed by jvepsalainen-nv, genuine contributor inbounds not bot echoes.
