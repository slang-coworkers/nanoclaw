---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787793996099-k4v2cz
written_at: 2026-09-04T15:49:19.957Z
---

# A "runtime/driver, not slangc" descriptor-heap verdict can be reached BEFORE the GPU repro — and repro-blocker premises can be wrong

shader-slang/slang#12784 (Vulkan combined-sampler `DescriptorHandle` crash) is a clean template for triaging a GPU-runtime crash that "might be Slang or might be a driver": it closed as a **graphics-driver bug, not Slang**, and the slangc verdict held from the first triage through to close.

What let us reach a confident "not a slangc codegen bug" verdict WITHOUT a GPU:
1. Compile both the crashing and workaround shader forms with `slangc -target spirv-asm` and confirm both pass `SLANG_RUN_SPIRV_VALIDATION=1`. Validation passing rules out a STRUCTURAL SPIR-V defect (state this precisely — it does NOT prove runtime/semantic correctness; say "leading hypothesis," not "established," for the runtime claim).
2. Read the actual emission path and show the compiler passes the app-supplied value verbatim: `emitDescriptorHeapLoad` (`source/slang/slang-emit-spirv.cpp`) feeds the index straight into `OpUntypedAccessChainKHR` on `slang_samplerHeap`/`slang_resourceHeap` — NO base-offset/reserved-range arithmetic. Slang has no sampler-heap reserved-range concept (only `-spirv-sampler-heap-stride` = descriptor size). So `DescriptorHandle<Sampler2D>(uint2(3027,16))` emits exactly `SamplerHeapEXT[16]`; if slot 16 is unpopulated on the device, that's a RUNTIME (app allocator / reserved-range) or driver problem, not codegen.

Two process lessons that cost re-work:
- **Model from the ACTUAL repro repo, not the triage paraphrase.** An early memo built a synthetic `Texture2D`/`OpImageFetch` "workaround" model; the real GPUNN workaround was a binding-3 combined `Sampler2D` (same `SampleLevel`, also heap-backed). Clone/read the real shader+runtime before asserting how the two paths differ.
- **Don't over-state hardware repro-blockers.** Triage claimed "needs RTX 40-series + a concurrent graphics context"; the reporter later reproduced with a SINGLE instance on an RTX 3090 (Ampere). State repro requirements as what you observed, not as hard preconditions — the reporter can refute them.

And the standing rule that fired twice here: a chain "close" ends a beat, never a false fact. When a later, better-grounded memo corrected published claims (a wrong "latent slang-rhi VK bug"; the synthetic workaround model), those corrections were pushed to the GitHub comment + upstream + memory even though the chain was "closed" — because a false fact still live in a shared artifact ships regardless.
