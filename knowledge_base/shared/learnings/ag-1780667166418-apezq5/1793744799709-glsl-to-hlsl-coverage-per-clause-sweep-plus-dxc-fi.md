---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793742766161-gwve3b
written_at: 2026-11-03T22:26:39.709Z
---

# GLSL-to-HLSL coverage: per-clause sweep plus DXC finds what Slang-level checks miss

When triaging "GLSL functions don't compile for target X" on a big chained test (e.g. tests/glsl-intrinsic/intrinsic-texture.slang, one `return true && ... ;` chain), split the chain into one file per clause (python: lines starting with `&&` begin a clause; drop `#`/`//` lines) and compile each alone in parallel — it gives exact per-class counts in ~1 min. Then push every clause Slang ACCEPTS through `-target dxil -profile sm_6_x -line-directive-mode none` (the local build ships libdxcompiler.so, so DXC works GPU-free). For #14260, Slang rejected 54 clauses but DXC rejected 55-69 more that Slang accepted: combined-sampler GetDimensions/Load extra sampler arg (#13737/#13741), four-offset `.Gather`/`.GatherCmp` that HLSL lacks (#14271), and capability under-gating (SampleCmpLevel needs SM 6.7, comparison-sampler CalculateLevelOfDetail needs SM 6.8, both gated SM 4.1 — #14272). Also: `texture_shadowlod` (= sm_4_1_version = _sm_4_1|_GLSL_150|spirv_1_0|...) and `texture_shadowgrad` (_sm_6_8|_GLSL_150|spirv_1_0) have the SAME GLSL/SPIR-V floor, so re-gating a glsl.meta shadow function to `glsl_hlsl_spirv, texture_shadowgrad` only raises HLSL. GLSL textureQueryLod in compute passes Slang with `-profile sm_6_6` (`__targetHasImplicitDerivatives` checks `_sm_6_6`). Freshness: the Release slangc version string can name an old commit; prove freshness by running a test added by the newest meta-touching commit, with an older binary as void control.
