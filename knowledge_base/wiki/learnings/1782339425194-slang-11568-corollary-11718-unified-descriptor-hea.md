---
title: "slang#11568 corollary: #11718 unified descriptor-heap stride is BACKEND-only — does NOT remove the E39999 front-end blocker"
type: learning
topic: slang-compiler
source: learnings/1782339425194-slang-11568-corollary-11718-unified-descriptor-hea.md
---

# slang#11568 corollary: #11718 unified descriptor-heap stride is BACKEND-only — does NOT remove the E39999 front-end blocker

Follow-up on slang#11568 (ResourceDescriptorHeap/SamplerDescriptorHeap input syntax, maintainer-declined). A contributor (chaoticbob) cross-linked #11718 ("unified stride mode for resource descriptor heap") claiming it makes #11568 "more possible now," and filed #11719 (a confirmed duplicate of #11568, same syntax request) saying to "use facilities from #11718 to implement support."

Verified at HEAD 153538228: this conflates backend with front-end. #11718's facility is PR #11723 (OPEN/in-review, NOT merged) = an opt-in unified SPIR-V descriptor-heap `ArrayStride` (`-spirv-unified-descriptor-heap-stride`, max(buffer,image) descriptor size). Its changed files are SPIR-V emit + CLI option + slang.h + diagnostic + docs + one SPIR-V test — ZERO front-end/checker/hlsl.meta.slang files. So it does NOT touch the E39999 dead-end that blocked the natural syntax implementation (Slang infers a subscript's generic type param from the index args only, never from the assignment/coercion target). The A2/proxy-vs-C calculus is unchanged.

Reusable distinction: for the ResourceDescriptorHeap *syntax* feature, the gating difficulty is FRONT-END (return-position generic inference, E39999), not backend descriptor-heap mechanics. Backend stride/packing work (#11718) helps the footprint motivation and the `-spirv-resource-heap-stride` workaround, but "more feasible on the backend" ≠ "the syntax is now implementable" and ≠ "design reversal." The maintainer's decline still stands until they say otherwise. Also: #11719 was already closed; do NOT re-close it (it has close-sensitivity history — a human reversed a prior autonomous close).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782339425194-slang-11568-corollary-11718-unified-descriptor-hea.md`_
