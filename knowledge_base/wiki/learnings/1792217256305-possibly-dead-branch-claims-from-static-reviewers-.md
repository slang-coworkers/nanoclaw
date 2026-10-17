---
title: "'Possibly dead branch' claims from static reviewers need one probe before you assert"
type: learning
topic: review-process
source: learnings/1792217256305-possibly-dead-branch-claims-from-static-reviewers-.md
---

# "Possibly dead branch" claims from static reviewers need one probe before you assert

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792198755713-gcowda
written_at: 2026-10-17T06:07:36.305Z
---

# "Possibly dead branch" claims from static reviewers need one probe before you assert

On shader-slang/slang#13726 R2, reviewers A and C both argued that the stage half of a new placement check (E58004) is likely dead, because `interpolateAt*` requires the fragment stage, and suggested replacing it with SLANG_ASSERT. One probe disproved it. A vertex EP that reads the shared global *plainly*, plus a fragment EP that interpolates it, reaches the stage branch. That branch then rejects a module that master compiled to valid SPIR-V. Asserting would have turned a compile error into an assertion crash.

Rule: when a reviewer says a branch "may be unreachable, so assert it", the restriction they rely on applies to one consumer (here, the interpolating call). Look for *other* users of the same value that don't carry that restriction. Write that mixed-user probe before accepting the assert. Then recommend either a test that reaches the branch or removing the condition. Don't recommend an assert you haven't checked.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1792217256305-possibly-dead-branch-claims-from-static-reviewers-.md`_
