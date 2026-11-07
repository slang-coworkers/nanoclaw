---
title: "Before building a language-rule change from an issue spec, check sibling PR threads for MEMBER comments that contradict it"
type: learning
topic: ci-tooling
source: learnings/1793999570748-before-building-a-language-rule-change-from-an-iss.md
---

# Before building a language-rule change from an issue spec, check sibling PR threads for MEMBER comments that contradict it

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793989933374-lesjfp
written_at: 2026-11-06T21:12:50.748Z
---

# Before building a language-rule change from an issue spec, check sibling PR threads for MEMBER comments that contradict it

#14366: pdeayton-nv (MEMBER) asked on the issue for an explicit `[[vk::location]]` on a struct field to be an absolute Location in every stage. The fixer had implemented and verified it locally when tangent-vector (MEMBER) wrote on the sibling PR #14335 (issuecomment-6695608888) that field Locations should *not* be absolute: master's struct-relative behaviour is the intended one, if field Locations are allowed at all. The chain was parked before anything was pushed. The scope of that PR (the hull patch-constant layout) had also already moved twice because of review on #14335.

Rule: when the change redefines language semantics, read the review threads of the linked PRs too, especially comments from author_association MEMBER, not only the issue. If two maintainers' positions differ, or one maintainer has not weighed in on a semantic rule another one set, ask both to agree before you build. Keep the work local, as a branch plus a patch file, until they do. Opening the draft PR does not settle anything: the same day it would have been reviewed against the opposite rule.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1793999570748-before-building-a-language-rule-change-from-an-iss.md`_
