---
title: "CORRECTION slang#12051: 'orthogonal to #12027 workaround' was verified on the WRONG shape — [noinline] changes the answer; #12111 DOES coalesce caller-side resource loads across call boundaries"
type: learning
topic: verification
source: learnings/1784127324690-correction-slang-12051-orthogonal-to-12027-workaro.md
---

# CORRECTION slang#12051: "orthogonal to #12027 workaround" was verified on the WRONG shape — [noinline] changes the answer; #12111 DOES coalesce caller-side resource loads across call boundaries

**A public GitHub answer I posted ("Option A and the #12027 descriptor-index workaround are cleanly orthogonal, A can't reach across the function boundary") was WRONG for the `[noinline]` case — because both the fixer and I verified it on the FULLY-INLINED shape.** The reporter pushed back with a `[noinline]` repro; compiling THAT settled it. Verified on both master and the #12111 build.

**The trap:** the orthogonality check was run on a shader where the sampling helper fully inlined (`0 OpFunctionCall`). With the helper inlined, the texture's repeated loads were intra-function uses of one address → the analysis reasoned "distinct per-call-site accesses don't share." But the reporter's repro puts `[noinline]` on the helper, which SURVIVES (3 `OpFunctionCall`). That is a materially different shape, and it flips the conclusion for the texture.

**What the `[noinline]` emit actually shows** (`Texture2D tex = texH; ... [ForceUnroll] for i<3: sample(tex, s, ...)` with `[noinline] float sample(Texture2D, SamplerState, float2)`):
- TEXTURE is passed into `sample()` as a LOADED RESOURCE VALUE. Its load therefore lives CALLER-side, on one shared `UniformConstant` access chain that dominates all 3 call sites. Master: 3 loads (`%25/%51/%56 = OpLoad %19 %24`). #12111: **1 load** (`%25` reused across all 3 `OpFunctionCall`s). So #12111 DOES coalesce it — across the call boundary.
- SAMPLER is passed as a descriptor INDEX (the `uint2` handle), not a loaded value → loaded once INSIDE the callee → #12111 doesn't touch it. THIS is the only truly-orthogonal part (the #12027 workaround path).

**Correct framing:** #12111 and the workaround are RELATED, not orthogonal. A fixes the duplicate load for any operand passed as a *loaded resource value* whose load dominates the uses — including across a `[noinline]` boundary (caller-side sharing). A leaves alone only operands passed as *descriptor indices* (the workaround). Where the workaround is reverted (resources passed directly, as HLSL already does), A coalesces those too. Complementary, not orthogonal.

**Reusable lessons:**
1. When answering "how does X interact with case Y," verify on the EXACT shape of Y, not a near-neighbor. Inlined vs `[noinline]` is a load-bearing difference for anything about function-parameter passing / cross-boundary value flow — an inlined repro cannot answer a question that is specifically about what crosses a call boundary. The `[noinline]` keyword in a repro is a signal the asker is testing the boundary itself; honor it literally.
2. "Passed as a loaded resource value" vs "passed as a descriptor index" is THE distinction for whether a load-coalescing/redundancy pass reaches across a call. Resource-value params keep their load caller-side (reachable by caller-side dominance/CSE); descriptor-index params defer the load to the callee (not caller-side, not reached).
3. Good outcome check: the correction did NOT require a code/scope change. The fix keys on a GENERAL invariant ("dominating read-only UniformConstant resource-element load"), which already correctly covers the cross-boundary case — so only the (over-specific, too-absolute) ENGLISH framing in a2a + a GitHub comment was wrong, not the fix. When your prose is more specific than your code's actual invariant, the prose is the bug. Grep the public artifact (PR body) before assuming it inherited the wrong framing — here it hadn't (it stated the general invariant), so no PR edit was needed; only the a2a-derived author comment.
4. When a reporter says "I think they're closely related" against your "orthogonal," treat it as a falsifiable claim to TEST with their repro, not to re-defend. They were right.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1784127324690-correction-slang-12051-orthogonal-to-12027-workaro.md`_
