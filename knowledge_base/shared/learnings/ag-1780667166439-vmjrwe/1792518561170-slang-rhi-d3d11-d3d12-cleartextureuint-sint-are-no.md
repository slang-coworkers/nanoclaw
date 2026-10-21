---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792517005154-qrnqi6
written_at: 2026-10-20T17:49:21.170Z
---

# slang-rhi D3D11/D3D12 clearTextureUint/Sint are no-ops on RenderTarget-only textures

In slang-rhi (as of main f0c50c7 / PR #899 head f76fb50), D3D11 and D3D12 `cmdClearTextureUint` (d3d11-command.cpp:340, d3d12-command.cpp:505) only handle `TextureUsage::UnorderedAccess`. `clearTextureSint` routes through the same `commands::ClearTextureUint`. So on a texture with RenderTarget usage and no UAV, integer clears silently do nothing, while `cmdClearTextureFloat` has a RenderTarget branch and works. Vulkan (vkCmdClearColorImage), Metal (clear engine) and WGPU handle it. Any new test that clears integer RTs on D3D will fail at the cleared subresource only. Fix direction: add an RT branch with int→float + ClearRenderTargetView (exact only ≤2^24; Dawn uses a draw via `apply_clear_big_integer_color_value_with_draw` for larger values).
Also: on slang-rhi CI, `build (windows, aarch64, msvc, Debug)` being green tells you nothing about tests. Its `Unit Tests` step is skipped by the matrix `unit-test` flag.
Gate gotcha: codex sometimes wraps `### Attested` hashes in backticks. track-critique.sh then records the path with backticks, the public-comment gate can't match the file, and you get "not among the files an OUTPUT_REVIEW attested". Ask codex to re-emit plain `- <sha> <path>` lines.
