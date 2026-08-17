---
title: "UPDATE slang#11568: maintainer team now implementing via csyonghe's UntypedResourceHandle proxy design (supersedes 'declined')"
type: learning
topic: slang-compiler
source: learnings/1782422418340-update-slang-11568-maintainer-team-now-implementin.md
---

# UPDATE slang#11568: maintainer team now implementing via csyonghe's UntypedResourceHandle proxy design (supersedes "declined")

State update on slang#11568 (ResourceDescriptorHeap/SamplerDescriptorHeap direct-indexing input syntax). My two earlier learnings said this was DECLINED (jkwak, release Unplanned) and that Approach A (return-position generic subscript) is a dead end (E39999). Both are now SUPERSEDED by the current direction:

- 2026-06-24 jkwak-work: "Yes, we are planning to implement this." (initially ambiguous between #11718 stride vs the #11568 feature).
- 2026-06-25 csyonghe (core architect) disambiguated with a concrete design (issuecomment-4804226544): add two builtin types **`UntypedResourceHandle`** / **`UntypedSamplerHandle`** mapping to dedicated IR type opcodes. `ResourceDescriptorHeap[i]` returns an `UntypedResourceHandle`, which implicit-casts to a resource/sampler type OR to a resource/sampler handle type (`Texture2D t = ResourceDescriptorHeap[i];` or `Texture2D.Handle h = ResourceDescriptorHeap[i];`). Conversions to resources reuse the existing resource-handle→resource IROps; conversion to a handle lowers as `Texture2D.Handle(uint2(i,0))`; a dangling `IRUntypedResourceHandle` lowers to `uint` before emit.

Why this matters: csyonghe's design is exactly the **A2/proxy** approach our fixer's spike recommended — returning a CONCRETE proxy type (not a return-position generic) is what sidesteps the E39999 inference dead-end. So the "Approach A dead end" learning is still technically correct (pure return-position generic subscript fails), but the resolution is the concrete-handle proxy, which the maintainer team chose. The general reusable insight stands: for a context-typed builtin, return a concrete proxy type with per-target implicit conversions rather than a return-position generic.

Status as of 2026-06-25: maintainer-team-owned (jkwak assigned, csyonghe designing); it is a PROPOSAL, not yet a converged+assigned task, and there is no ask to our bot — so no bot implementation. Issue OPEN. Future triagers: do NOT treat #11568 as declined; track the maintainer team's design. #11719 is a dup (closed-completed by a human; leave its state alone). #11718 (unified descriptor-heap stride, PR #11723) is the related backend/footprint piece.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782422418340-update-slang-11568-maintainer-team-now-implementin.md`_
