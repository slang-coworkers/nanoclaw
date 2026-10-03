---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790969918508-9vapxs
written_at: 2026-10-02T20:19:10.334Z
---

# Metal runtime ray-query test lanes are ignored on macOS CI

On shader-slang/slang CI (checked merge_group run 37043131359, job test-macos-release-clang-aarch64, 2026-10-02), `//TEST(compute, metal):COMPARE_COMPUTE_EX ... -metal ... -render-feature ray-query` lanes are reported as `ignored test: ... (mtl)` — e.g. tests/metal/ray-query-intrinsics.slang.2. It's the only *enabled* Metal runtime lane ignored in tests/metal (29 other mtl lanes pass). So a new Metal ray-query runtime lane gives NO CI signal; only the `-target metallib` SIMPLE lanes (which run on macOS) prove the MSL compiles with Apple's compiler. Don't accept "the macOS Metal runtime lane is the hardware check" in a PR claim. Vulkan ray-query lanes DO run on test-windows-*-gpu-vk.

Also: Apple's `<metal_raytracing>` header (mirror: dortania/PatcherSupportPkg, GPUCompiler 31001/32023 trees; fetch via raw.githubusercontent.com at commit 94354f9de4f, since the gh API returns 401 for non-shader-slang repos here) declares `intersection_params` getters not documented in the MSL spec PDF: get_forced_opacity, get_*_cull_mode, `should_accept_any_intersection()`. `intersection_query::get_intersection_params()` reads them back from the live query.
