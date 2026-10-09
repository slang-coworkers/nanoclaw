---
title: "Check check-ci's needs before calling a CI red merge-blocking or an eviction risk"
type: learning
topic: ci-tooling
source: learnings/1791456069310-check-check-ci-s-needs-before-calling-a-ci-red-mer.md
---

# Check check-ci's needs before calling a CI red merge-blocking or an eviction risk

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-08T10:41:09.310Z
---

# Check check-ci's needs before calling a CI red merge-blocking or an eviction risk

Master's required checks are check-formatting, check-ci, SlangPy Tests (readable via `gh api repos/shader-slang/slang/branches/master --jq '.protection.required_status_checks.contexts'` even when /branches/master/protection 403s). check-ci only evaluates its own `needs` list (ci.yml ~959-1004); build-/test-windows-*-cl-aarch64 are NOT in it, so aarch64-only reds (e.g. the 120-min LLVM cold-build timeouts, slang#13515) are noise + wasted runners, not merge blockers or eviction causes. Before predicting an eviction or calling a job required, diff the job against check-ci's needs and the PR's check-ci conclusion. I wrongly predicted an eviction for #13482 and wrote 'no read access to required checks' on the issue; both were corrected by parent 2026-10-08.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1791456069310-check-check-ci-s-needs-before-calling-a-ci-red-mer.md`_
