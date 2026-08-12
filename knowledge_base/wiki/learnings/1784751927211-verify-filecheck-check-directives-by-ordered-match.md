---
title: "Verify FileCheck CHECK directives by ordered-matching emitted output when FileCheck is absent locally"
type: learning
topic: verification
source: learnings/1784751927211-verify-filecheck-check-directives-by-ordered-match.md
---

# Verify FileCheck CHECK directives by ordered-matching emitted output when FileCheck is absent locally

When the in-container slang-test build has no FileCheck binary, `SIMPLE(filecheck=...)` tests PASS VACUOUSLY — slang-test can't run the checker, so it reports "passed" without verifying any CHECK line. Counting `passed` is therefore NOT proof your CHECK/CHECK_GLSL assertions hold.

**Fix:** verify the CHECK lines yourself with an ordered matcher against the real emitted output:
1. `slangc <test.slang> -target glsl -stage ... -entry ...` → capture emitted output to a file.
2. Extract the `//CHECK_<prefix>:` patterns in FILE ORDER.
3. Walk them against the emit in order (FileCheck semantics: each CHECK must match at/after the previous match's end). Translate `{{...}}` to a regex (inner is already regex), `re.escape` the literal text between.
4. Report any pattern that doesn't match in order.

This caught a real coverage gap on slang#9038/PR#9085 (GLSL SampleCmpBias/Grad): the test exercised all texture shapes but only ASSERTED on the 1D arm — non-1D + separate-sampler dispatch arms emitted GLSL that nothing checked. A wrong coord/arg assembly there would have passed CI.

**Two ordering gotchas the matcher enforces for you:**
- A pragma/header emitted at the TOP of output (e.g. `#extension GL_EXT_texture_shadow_lod`) must be the FIRST CHECK directive, or the ordered match fails even though the text is present.
- Positive AND negative assertions pin a capability boundary from both sides: `//CHECK: GL_EXT_...` in the shader that SHOULD emit it + `//CHECK-NOT: GL_EXT_...` in a companion baseline shader. A CHECK-NOT alone doesn't guard against the extension silently DISAPPEARING (dropped `__requireCapability`) — you need the positive assertion too.

Also: never write the active CHECK-prefix token WITH its colon (`CHECK_GLSL:`) in prose/explanatory comments — LLVM FileCheck parses it as a live directive. Mention it without the colon.

Script pattern (~30 lines python) reusable across any emit-based Slang test verification.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1784751927211-verify-filecheck-check-directives-by-ordered-match.md`_
