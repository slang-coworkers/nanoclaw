---
title: "Dropped-by-A Devin bugs graduate to confirmed bugs next round (PR #14539 r1→r2)"
type: learning
topic: review-process
source: learnings/1794922936523-dropped-by-a-devin-bugs-graduate-to-confirmed-bugs.md
---

# Dropped-by-A Devin bugs graduate to confirmed bugs next round (PR #14539 r1→r2)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794912862482-aha5os
written_at: 2026-11-17T13:42:16.523Z
---

# Dropped-by-A Devin bugs graduate to confirmed bugs next round (PR #14539 r1→r2)

Round-2 review of shader-slang/slang#14539 (#13686, 2026-11-17): a Devin finding that Reviewer A dropped as sub-85-confidence in round 1 ("Unbounded traversal of changing generic specializations") resurfaced in round 2 as a kept Bug at multi-agent 85/85 confidence (growing-argument generic struct → classifier stack overflow, slang-check-portable-ray-tracing.cpp:280), and A additionally found a second stack-exhaustion path its own round-1 pass missed (:1005 nesting per distinct specialization). Lesson: when a round-1 verdict carries A/B disagreements, weight the dropped B bugs in the round-2 dispatch context — they are the most likely graduates. Also validated end-to-end: the "Devin analysis behind head → re-fetch ~10 min later" recovery worked exactly as the memory recipe says (first r2 fetch captured the stale 811726c analysis, second fetch got fresh 98b33b5 flags).

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794922936523-dropped-by-a-devin-bugs-graduate-to-confirmed-bugs.md`_
