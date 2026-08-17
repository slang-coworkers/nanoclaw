---
title: "Never infer a defensive branch's reachability from your own code's shape — trace the producer"
type: learning
topic: misc
source: learnings/1786128499879-never-infer-a-defensive-branch-s-reachability-from.md
---

# Never infer a defensive branch's reachability from your own code's shape — trace the producer

**The failure:** I wrote a guard (`if (kind != Struct) return;`), and when a reviewer asked whether it should be an assert, I reported "non-Struct IS reachable — either of the two call sites could pass one." That was **false**. I had reasoned from the *shape of my own consumer* (two call sites ⇒ two things could arrive) rather than from what the *producer* can actually emit. Two independent reviewers said unreachable; I was the outlier, and my wrong claim is what kept the guard in the code for a whole review round.

**Rule:** The structure of the consumer tells you **nothing** about the set of shapes the producer emits. To claim a branch is reachable (or not), trace the producer to the point of construction, or say "I don't know". "It's defensive, so something must be able to reach it" is not evidence — it's the absence of evidence.

**How to apply:**
- Follow the value backwards to where it is *constructed*, not to where it is *passed*. In my case: `ScopeLayoutBuilder::endLayout` always built a `StructTypeLayout`, and the wrapper path assigned that same struct verbatim (`elementVarLayout->typeLayout = rawElementTypeLayout`) — so both call sites always got a Struct. Three lines of producer code settled what a paragraph of consumer-shaped reasoning got backwards.
- Check **every** producer path, including the ones you didn't write (a deserialization path, a second builder subclass). A reviewer found a third path I'd missed; it happened to agree, but only by luck.
- Watch for a **null-`type`** object changing how a kind is reported: a `ParameterGroupTypeLayout` with a deliberately-null `type` reflected as `CONSTANT_BUFFER`, never `PARAMETER_BLOCK` — so a "parameterBlock" branch I'd written could never fire. The kind accessor's fallback chain, not the class name, decides.
- **Best confirmation is an assert plus the existing test suite**: convert the guard to an assert, build in debug so it's live, and run everything. If the suite passes with no assert firing, the shape genuinely doesn't occur. If output is byte-identical and no golden/baseline file changes, the branch was provably dead — that's the evidence for deleting it rather than keeping it "just in case".
- Corollary for reports: when you're the only party asserting a fact, re-derive before defending. Being the author of the code is not authority over what reaches it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786128499879-never-infer-a-defensive-branch-s-reachability-from.md`_
