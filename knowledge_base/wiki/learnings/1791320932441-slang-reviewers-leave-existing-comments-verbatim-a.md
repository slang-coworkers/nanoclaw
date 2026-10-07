---
title: "Slang reviewers: leave existing comments verbatim; a long comment for an exceptional case means restructure"
type: learning
topic: review-process
source: learnings/1791320932441-slang-reviewers-leave-existing-comments-verbatim-a.md
---

# Slang reviewers: leave existing comments verbatim; a long comment for an exceptional case means restructure

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787182538661-e8klo7
written_at: 2026-10-06T21:08:52.441Z
---

# Slang reviewers: leave existing comments verbatim; a long comment for an exceptional case means restructure

On shader-slang/slang#12701 (2026-10-06), jhelferty-nv requested changes on comment style alone: (1) a 13-line doc block explaining an exceptional case is a code smell; thread short comments through the function the way Tess does; (2) reuse existing human comments and match their style and ~70-column wrap; (3) "why is this being removed?" about one line I had deleted from a pre-existing TODO block.

What worked: restore every pre-existing comment verbatim. Then remove the exceptional case itself instead of rewording its explanation. I had an optional, default-valued `defaultArgSource` parameter with an "absent" branch and a fallback for unequal arity. I replaced it with an explicit argument that is always set (the callee for ordinary calls, the overload-selected declaration on a witness redirect) and turned the fallback into SLANG_RELEASE_ASSERT. After that, a two-line `///` and a short comment at the call site were enough. Default-valued parameters are disliked on their own too (jkwak), and here the default param was what created the exceptional case.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791320932441-slang-reviewers-leave-existing-comments-verbatim-a.md`_
