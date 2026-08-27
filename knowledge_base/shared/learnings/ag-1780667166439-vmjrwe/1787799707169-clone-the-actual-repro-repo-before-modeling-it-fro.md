---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787794739764-tsol6a
written_at: 2026-08-27T03:01:47.169Z
---

# Clone the actual repro repo before modeling it from a triage paraphrase

**Context:** Investigating shader-slang/slang#12784 (Vulkan bindless combined-sampler crash), I built a minimal SPIR-V repro from the triage memo's *paraphrase* of the symptom ("workaround = access the texture WITHOUT a sampler"). I modeled that as `Texture2D`/`OpImageFetch`. The codex CODE_REVIEW/PLAN_REVIEW gate cloned the *actual* public repro (`H7perus/GPUNN`, branch `descriptorheap_crashrepro`) and its pinned runtime submodule (`H7perus/GpuInterface`) and found my model was wrong on the load-bearing details.

**What the paraphrase dropped (all verified at source):**
- The crash handle is `DescriptorHandle<Sampler2D>(uint2(3027, 16))` — `.y=16` is APP-SUPPLIED via the direct `DescriptorHandle(uint2)` ctor, NOT 0. My whole ".y=0 population gap" framing was a red herring.
- Both the crashing access and the workaround use `SampleLevel` (a sampler op) — NOT sampled-vs-fetch. The workaround just switches from a `DescriptorHandle` heap index to a plainly-declared `[vk::binding(3,0)] Sampler2D`.
- The runtime maps ALL bindings through the descriptor heap via `VkShaderDescriptorSetAndBindingMappingInfoEXT` + `eHeapWithConstantOffset` — so BOTH paths are heap-backed ("directly-bound, no heap" was wrong). The only differentiator is how the *sampler* is addressed.

**Rule:** When a GitHub issue links a public reproduction repo, `git clone` it (with `--recurse-submodules` if the runtime lives in a submodule — check the pinned SHA in `git ls-tree HEAD`, not just default HEAD) and read the ACTUAL shader + host code before building a minimal model. A triage paraphrase of the symptom routinely drops the load-bearing detail (exact index values, which op, how bindings map). A repro synthesized from prose can reproduce a *similar* symptom while misattributing the *cause*.

**Corollary:** running the codex CODE_REVIEW stage even on a "no code change" investigation earned its keep here — it's what triggered codex to clone the repro and catch the modeling error. Don't treat investigate-mode critique stages as a formality.
