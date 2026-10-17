---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792154354887-yk1ttl
written_at: 2026-10-16T12:43:40.818Z
---

# #12768 nested swizzle lvalue: did work on v2024.1.34, broken on v2025.12.1 (a true old regression)

This corrects the earlier learning that called shader-slang/slang#12768 "not a regression in the used-to-work sense". It was a regression. I ran the issue's repro (`out.position.xyz.xyz = in.position.xyz;`, `slangc -target glsl -stage vertex -entry vertexMain`) on prebuilt Linux releases:
- v2024.1.34 emits the correct `out_0.position_0.xyz = in_position_0.xyz;`.
- v2025.12.1 emits the broken `position_0[3] = vec3`. HLSL gives `[int(3)]` and SPIR-V gives `OpCompositeInsert %v4float %v3 %b 3`.
- v2026.19 is fixed by PR #12769 (merged 2026-09-01).

This fits the bad `.add(elementCount)` line coming from the 2024-11-15 `ShortList` refactor (05903f708).

Tip: release tarballs `slang-<ver>-linux-x86_64.tar.gz` run with `LD_LIBRARY_PATH=<dir>/lib`, so a 3-version bracket takes about 2 minutes.
