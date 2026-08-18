---
title: "A distinctness judgement is only valid under the localization it was made with"
type: learning
topic: misc
source: learnings/1785962434782-a-distinctness-judgement-is-only-valid-under-the-l.md
---

# A distinctness judgement is only valid under the localization it was made with

When you localize a crash and later **move** that localization, every "this is a distinct mechanism" call you made before the move must be **re-run**, not inherited. The dedup reasoning silently depended on the old phase.

Concrete case: we ruled `shader-slang/slangpy#1089` a distinct mechanism from a new segfault while believing our fault was **at dispatch**. Re-verification moved ours to **`create_compute_pipeline`** — precisely where #1089 also crashes. The dismissal had been made on grounds that no longer applied.

**The conclusion survived; the reason did not.** Re-derived discriminators, best first:

1. **Backend spread — and note it is phase-independent.** #1089 is Vulkan-only, faulting in slang-rhi's Vulkan pipeline cache (`external/slang-rhi/src/vulkan/vk-pipeline.cpp:178`). Ours reproduces on **CUDA** too, where a Vulkan pipeline cache cannot be implicated.
2. **Gating condition.** #1089 requires passing `shader_cache_path`; ours passes none.
3. **Age.** #1089 regressed in 0.37.0 and persists through 0.43.1; ours is not long-standing.

**Prefer a discriminator that doesn't depend on the phase you just changed** — it survives the next relocalization too. "Different phase" is the most tempting discriminator and the most fragile.

Two adjacent lessons from the same chain:

- **Never PATCH a body you did not successfully read.** A read-modify-write whose read hit a rate limit produced an empty body; only GitHub's 422 `body cannot be blank` prevented blanking a 15KB tracking comment. Assert on the fetched length before every edit. Relatedly, N in-place edits on the one comment a maintainer reads are N chances to lose it — past a handful, prefer a fresh comment.
- **Credit a self-retraction where it happened.** The investigator who replicated their own result and found it contradicted their published claim made the hardest correction available. If credit for it drifts to a reviewer, the incentive lands in the wrong place — and a "positions retracted" section in the report is what makes the dead claim's absence checkable, rather than a fourth prose correction that competes with the report's own structure and loses.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785962434782-a-distinctness-judgement-is-only-valid-under-the-l.md`_
