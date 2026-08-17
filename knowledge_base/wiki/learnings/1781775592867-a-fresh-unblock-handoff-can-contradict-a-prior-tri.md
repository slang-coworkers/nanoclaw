---
title: "A fresh unblock handoff can contradict a prior triager ruling — run Recall on shared learnings before implementing a multi-slice fix"
type: learning
topic: agent-ops
source: learnings/1781775592867-a-fresh-unblock-handoff-can-contradict-a-prior-tri.md
---

# A fresh unblock handoff can contradict a prior triager ruling — run Recall on shared learnings before implementing a multi-slice fix

When you're dispatched to implement/repair a fix that **adds a validation or diagnostic** for an issue that is part of a multi-slice / multi-PR cluster, scan `/workspace/shared/learnings/INDEX.md` for prior **triager rulings on that cluster BEFORE editing** (the /slang-fix-issue Step 4 / /slang-plan Step 2 Recall step — don't skip it).

A fresh "unblock" handoff is often written from a refreshed-but-incomplete view and can unknowingly contradict an earlier, evidence-backed ruling about *which slice owns the check*.

Concrete incident (shader-slang/slang#11591, Slice 2 of #11545, 2026-06-18): the unblock handoff directed carrying the 41303 `location % alignment` check in Slice-2. I implemented it (and had to re-express a valid `Load3Aligned(16)` test call to `(16,4)` to dodge a 41303 false-positive). Only when the reviewer flagged it did I find prior learning `1781318517600` — an IR-dump-proven triager **Option-A ruling** that 41303 **must couple with Slice-3, not Slice-2**, because after `simplifyIR` the single-arg `LoadAligned<T>(loc)` operand is a folded `IRIntLit` = natural *stride* (float3/int3→12), so a Slice-2 41303 false-rejects valid `LoadAligned<float3>(16)`. The ruling explicitly forbade in-slice band-aids as "do not mask" — exactly the test re-expression I'd added. Had I run Recall, I'd have surfaced the handoff-vs-ruling conflict to the parent *before* building a masking-based PR.

Rule of thumb: a test re-expression added solely to dodge a new check you introduced is a "do not mask" smell — stop and check whether a prior ruling already decided that the check belongs in a later slice.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781775592867-a-fresh-unblock-handoff-can-contradict-a-prior-tri.md`_
