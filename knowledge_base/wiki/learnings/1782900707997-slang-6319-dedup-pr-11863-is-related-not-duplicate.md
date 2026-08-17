---
title: "slang #6319 dedup: PR #11863 is related-not-duplicate; duplicate-SV vs depth-overlap are complementary checks"
type: learning
topic: slang-compiler
source: learnings/1782900707997-slang-6319-dedup-pr-11863-is-related-not-duplicate.md
---

# slang #6319 dedup: PR #11863 is related-not-duplicate; duplicate-SV vs depth-overlap are complementary checks

When maintainer asks "make a PR for #6319 if we don't already have one," the trap is PR #11863 ("Reject multiple depth output semantics", branch fix/issue-11855). It shows up in a `6319` PR search and the issue timeline, but it **Closes #11855 only** and its own body explicitly says it is NOT a fix for #6319 ("this is the depth-specific instance; #6319 tracks the broader duplicate/overlapping validation; the collector is structured so it can later feed a general check"). Read the PR body's Closes/Related lines before concluding a dup exists.

Why they're complementary (neither subsumes the other), both needed:
- #6319 = exact **DUPLICATE**: same system-value semantic name+index on 2+ entry-point params (e.g. two `SV_VertexID`). Caught by a name+index+direction dedup.
- #11863 = **OVERLAP**: *distinct* depth-output names (SV_Depth / SV_DepthGreaterEqual / SV_DepthLessEqual) that lower to the same builtin. NOT caught by a name+index dedup (names differ).

Both fixes live in the SAME function `validateEntryPoint` (slang-check-shader.cpp), which validates each param's SV semantic in isolation (`validateSystemValueSemantic`) with NO cross-param aggregation — that's the shared gap. So an independent #6319 PR on master has a trivial textual conflict with #11863's aggregation block, and they must coordinate the new diagnostic code (both would grab 30705; second one uses 30706).

KEY scoping for a duplicate-SV diagnostic: fire for **system values ONLY**. The post-linking IR pass `fixFieldSemanticsOfFlatStruct` (slang-ir-legalize-varying-params.cpp:3730-3910) intentionally RE-INDEXES overlapping *user* semantics (legit — that's why user dups aren't an error); it cannot legalize system values (one hardware builtin per SV) and runs after codegen anyway. Flagging user semantics would break that legalization. Also key on index (SV_Target0 vs SV_Target1 are distinct) and direction.

Bonus severity signal @HEAD 7f79b923f: duplicate SV_VertexID → wgsl/hlsl invalid dup builtins (exit 0) AND spirv-asm ICE "hit unreachable code: Unimplemented system value in spirv emit" (exit 255). Single SV_VertexID is clean, so the SPIR-V crash is duplicate-specific.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782900707997-slang-6319-dedup-pr-11863-is-related-not-duplicate.md`_
