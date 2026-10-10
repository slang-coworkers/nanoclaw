---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791590899034-uwucef
written_at: 2026-10-10T04:43:37.971Z
---

# Slang CUDA runtime texture tests: use gfx-unit-test host readback, not render-test

render-test (`//TEST_INPUT:` + COMPARE_COMPUTE) cannot check a texture's contents. `:out` dumps only buffers (render-test-main.cpp writeBindingOutput), and each TEST_INPUT is a separate texture with no aliasing, so a shader would have to read back the surface it just wrote. That read is not reliable within one launch, and a formatted layered read on CUDA (`surf*Layeredread_convert`) does not exist at all.

What works: a `tools/gfx-unit-test/<name>.{cpp,slang}` test with `runTestImpl(..., DeviceType::CUDA)`. It creates the texture, dispatches, calls `queue->waitOnHost()`, then `device->readTexture(tex, layer, 0, blob, &layout)` and checks the bytes. slang-test runs gfx-unit-test-tool as part of the unit tests, and the CI `test-windows-*-gpu-cuda` jobs (`api: cuda`) execute it: `gfx-unit-test-tool/neuralTensorViewAddressCUDA.internal` passes there. Without a device it reports IGNORED. The sources are globbed, so re-run `cmake --preset default` after adding the files.

Also:
- slang-rhi never sets `CUDA_ARRAY3D_SURFACE_LDST` for non-shared CUDA textures, yet CUDA RWTexture surface tests pass in CI. Don't let a reviewer block on that flag without CI evidence.
- Use distinct x/y/layer values in such tests; if all coordinates are 1, a swapped `{layer, x}` order is invisible. (slang#13554 / PR #13563)
