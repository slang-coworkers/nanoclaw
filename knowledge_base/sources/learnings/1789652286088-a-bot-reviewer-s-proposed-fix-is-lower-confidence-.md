---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789460667721-wi2xgn
written_at: 2026-09-17T13:38:06.088Z
---

# A bot reviewer's proposed FIX is lower-confidence than its FINDING — verify suggested remedies at source before relaying them as actionable

When relaying a correctness-reviewer's finding that includes a "Suggested fix," treat the *finding* (the problem it identified) as the high-value output and the *proposed remedy* as a lower-confidence hypothesis. A plausible-sounding fix can be actively wrong — verify it against source before presenting it to the fixer/author as actionable, or explicitly label it "reviewer's suggestion, unverified."

Concrete case (shader-slang/slang#13086, round 6): Reviewer A correctly found that a direct-resource constructor's combined-sampler diagnostic under `spvBindlessTextureNV+spvDescriptorHeapEXT` recommends a remedy that reproduces the very miscompile the PR fixes. But BOTH of A's suggested fixes were wrong, as the fixer traced and I confirmed at source:
- "Route it through the EXT-heap helper like the `.Handle` ctor does" → **silent miscompile**: `getDescriptorFromDescriptorHeapEXT`'s combined-sampler branch is `__makeCombinedTextureSamplerFromHandle<T>(handle)` — it consumes the WHOLE `uint2` (both lanes: resource index + sampler index), while the single-index resource/sampler branches use `handle.x`. The direct-resource ctor only has `uint2(index, 0)`, so the sampler index silently becomes 0.
- "Add `static_assert(!usesNativeSpirvDescriptorHandle<This>())` at the top" → **regression**: that predicate is true for every NV-encodable type, so it would also reject the currently-working plain `Texture2D t = ResourceDescriptorHeap[i]` under NV+EXT (which loads correctly via the EXT resource heap's `.x`). It conflated "reject the combined-sampler direct-resource" with "reject all encodable direct-resource."

Reusable rule for descriptor-handle work specifically: a `CombinedTextureSampler` needs BOTH `uint2` lanes (`.x`=resource/texture index, `.y`=sampler index); any path that only has a single index (a `uint2(index, 0)`-built handle from a single `ResourceDescriptorHeap[i]`) genuinely cannot construct a combined sampler — the rejection is correct; only a misdirecting remedy message is the bug. And the right fix for a "the rejection is correct but the recommended remedy is wrong under capability X" case is usually a message/workflow design decision for the maintainer, not a speculative code patch that risks trading a loud-but-wrong diagnostic for a silent miscompile.
