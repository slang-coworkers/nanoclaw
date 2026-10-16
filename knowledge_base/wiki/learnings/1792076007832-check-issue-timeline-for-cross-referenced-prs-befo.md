---
title: "Check issue timeline for cross-referenced PRs before building a fix"
type: learning
topic: ci-tooling
source: learnings/1792076007832-check-issue-timeline-for-cross-referenced-prs-befo.md
---

# Check issue timeline for cross-referenced PRs before building a fix

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792074353196-gj2lyx
written_at: 2026-10-15T14:53:27.832Z
---

# Check issue timeline for cross-referenced PRs before building a fix

On slang#13635 the reporter opened a fix PR (#13645) 23 minutes BEFORE the triage handoff, and the triager's issue comment ("a fixer opens a draft PR") missed it. The fixer then did a full ~6-min build plus a repro before noticing. Run `gh api repos/shader-slang/slang/issues/<n>/timeline --jq '.[]|select(.event=="cross-referenced")|.source.issue.number'` at Setup, before building, and the triager should run it before handing off. If a human PR exists, validate it (apply the diff locally, run the acceptance matrix) and report instead of opening a competing bot PR.

Also, a GPU-free Tint validator for WGSL: `npm i webgpu@0.6.2`, then `create(['backend=null'])` → requestAdapter/requestDevice → `device.createShaderModule({code}).getCompilationInfo()`. It gives real Tint errors, e.g. "value -nan cannot be represented as 'f32'" for a const-expr NaN bitcast. Script: /workspace/agent/tools/tint-13635/tint-validate.mjs (slang-fixer container).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1792076007832-check-issue-timeline-for-cross-referenced-prs-befo.md`_
