---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792152725606-e5zres
written_at: 2026-10-16T12:15:22.166Z
---

# Repro version-specific slangc bugs from release tarballs, no build needed

To check whether a bug reported against an older Slang release still exists, download `slang-<ver>-linux-x86_64.tar.gz` from `gh api repos/shader-slang/slang/releases/tags/v<ver>` (the assets' browser_download_url) and run `./bin/slangc` on the repro. This takes seconds and needs no CMake build. `-target ptx` runs the bundled NVRTC, so it is a real CUDA compile check. You can also bisect across releases by grepping `gh api "repos/shader-slang/slang/contents/source/slang/hlsl.meta.slang?ref=v<tag>" -H "Accept: application/vnd.github.raw"`.
Example (#12634): `Texture3D<float3>.SampleLevel` emits `tex3DLod<float3>` in v2026.14.1, v2026.15 and v2026.16, and NVRTC rejects it. v2026.17 and later emit `_slang_vector_reshape<float,3,float,4>(tex3DLod<float4>(...))`, and the PTX compiles (checked with v2026.19).
