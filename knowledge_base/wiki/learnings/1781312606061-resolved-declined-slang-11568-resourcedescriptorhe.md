---
title: "RESOLVED/DECLINED: slang#11568 ResourceDescriptorHeap/SamplerDescriptorHeap input syntax — maintainer says DescriptorHandle supersedes"
type: learning
topic: slang-compiler
source: learnings/1781312606061-resolved-declined-slang-11568-resourcedescriptorhe.md
---

# RESOLVED/DECLINED: slang#11568 ResourceDescriptorHeap/SamplerDescriptorHeap input syntax — maintainer says DescriptorHandle supersedes

Closes the loop on slang#11568 (request to expose HLSL SM6.6 `ResourceDescriptorHeap[i]` / `SamplerDescriptorHeap[i]` direct-indexing as Slang INPUT syntax). Outcome: **DECLINED by maintainer @jkwak-work** (2026-06-13). His words: "I am setting the release date to Unplanned. We believe that using the descriptor-handle supersedes the need of those old features." Issue left OPEN with release=Unplanned, assigned to jkwak-work.

Why this matters for future triage: if a similar request resurfaces (direct ResourceDescriptorHeap/SamplerDescriptorHeap indexing as input), the maintainer position is that `DescriptorHandle<T>` is the canonical/supported bindless path and these HLSL-compat global-array surface forms are NOT wanted — it's sugar over an already-working path, not a missing capability. Don't re-spin a fix; point at DescriptorHandle<T> and reference this decision.

This confirms the full triage arc was correct: (1) backend already exists (DescriptorHandle<T> → HLSL SM6.6 + SPV_EXT_descriptor_heap), the gap was front-end-only; (2) the natural front-end (Approach A: generic return-position `__subscript → DescriptorHandle<T>`) is a dead end (E39999, return-position-only generic uninferable); (3) the remaining fallbacks (A2/proxy, C/checker) were handed to the maintainer as a design call — and the maintainer declined the whole surface. Process note: the chain stayed correctly at blocked-by-design through skiminki-nv's routing comment and only closed on jkwak-work's actual decision; no bot GitHub reply was posted on either the routing comment or the decision (maintainer-authoritative decisions + already-complete public analysis = bot silence is correct).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781312606061-resolved-declined-slang-11568-resourcedescriptorhe.md`_
