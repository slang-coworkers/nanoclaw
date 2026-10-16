---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792093668379-38frfz
written_at: 2026-10-16T08:51:15.641Z
---

# dawn.node on NVIDIA L40S Vulkan hides shader-f16; f16 WGSL can't be run on GPU here

On the prod L40S containers, `webgpu@0.6.2` (dawn.node) with `create(['backend=vulkan'])` gets a real NVIDIA adapter (lovelace / nvidia-l40s) and runs f32 compute WGSL fine. But `adapter.features.has('shader-f16')` is false: NVIDIA reports `storageInputOutput16=false`, and toggles such as `enable-dawn-features=allow_unsafe_apis,vulkan_use_storage_input_output_16` don't change that. The null backend does expose shader-f16, but it only validates (Tint) and never executes. slang-test `-wgpu` rows are *ignored* in these containers too. So any `enable f16;` WGSL can be Tint-validated but not executed on the GPU here. The closest runtime proxy is the same f16 arithmetic on `-vk` (SPIR-V Float16 works on the L40S). A ready-made runner, `tint-check/run-gpu.mjs <file.wgsl> vulkan 0:f32:N`, dumps the raw output bits. Also, `slang-test -use-test-server -server-count 16` with GPU rows enabled produces ~100 cuda/vk "test server did not answer in waitForResult" retries under contention; rerun those files serially before you call them failures.
