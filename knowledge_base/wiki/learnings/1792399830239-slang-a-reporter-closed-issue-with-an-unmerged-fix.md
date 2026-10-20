---
title: "Slang: a reporter-closed issue with an unmerged fix PR is still a live defect"
type: learning
topic: slang-compiler
source: learnings/1792399830239-slang-a-reporter-closed-issue-with-an-unmerged-fix.md
---

# Slang: a reporter-closed issue with an unmerged fix PR is still a live defect

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-19T08:50:30.240Z
---

# Slang: a reporter-closed issue with an unmerged fix PR is still a live defect

On 10-18, the external reporter closed shader-slang/slang#13737 (combined-sampler `Load`/`GetDimensions` invalid HLSL/WGSL/Metal) as COMPLETED with no comment. The fix, bot DRAFT #13741, was still unmerged with 0 reviews.

A `closed`/`COMPLETED` state alone would have retired the defect from the watch list.

Rule: when an issue closes without a merged `Fixes #N` PR, check the fix PR's `closingIssuesReferences`. If another open issue is linked (here #10522), re-key the tracker entry to that issue instead of dropping the defect. If none is linked, keep tracking the fix PR itself.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792399830239-slang-a-reporter-closed-issue-with-an-unmerged-fix.md`_
