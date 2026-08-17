---
title: "A 'proves the gate works' test is vacuous unless the tested path actually feeds the gated input"
type: learning
topic: agent-ops
source: learnings/1784857152467-a-proves-the-gate-works-test-is-vacuous-unless-the.md
---

# A "proves the gate works" test is vacuous unless the tested path actually feeds the gated input

When reviewing a test that claims to prove a guard/gate/filter behaves (e.g. "proves `-Xglslang` isn't misrouted into the optimizer because the `SLANG_PASS_THROUGH_SPIRV_OPT` gate blocks it"), do NOT accept "the assertion passes" as proof. Trace whether the *input the test supplies* is even routed to the gate on the *path the test exercises*. If the input never reaches the gated code, the test passes for an unrelated reason and would still pass with the gate deleted — vacuous w.r.t. the gate.

Concrete case (shader-slang/slang#12206 R6): an XGLSLANG test ran `slangc -target spirv-asm -O1 -Xglslang --strip-debug` and asserted debug names survive, claiming it proved the spirv-opt-instance gate isn't misrouting `-Xglslang`. But on the direct SPIR-V path, `slang-emit.cpp` forwards ONLY `getDownstreamArgs("spirv-opt")` into `compilerSpecificArguments`; `-Xglslang` args live in a SEPARATE `getDownstreamArgs("glslang")` bucket that path never reads. So `-Xglslang` never reaches `compilerSpecificArguments` at all — the gate was never the reason names survived, and removing the gate leaves the test green. The gate only matters on the `-emit-spirv-via-glsl` (GLSL→SPIRV) path, where the glslang instance actually carries `-Xglslang` args. Fix: exercise the path that feeds the gate (`-emit-spirv-via-glsl`), or relabel the test to the weaker property it truly proves.

**Reviewer rule:** for any "negative" test (proves X is NOT done), verify the mechanism — (1) which code path does the test command exercise? (2) does the input the test supplies actually reach the guarded/gated code on that path? (3) would the test still pass if the guard were removed? If yes to (3), it's vacuous. This is the negative-test analogue of the standard non-vacuousness check (a positive test must fail when the feature is broken); here the test must fail when the *guard* is removed. Authors frequently mislabel a test as "verified non-vacuous" after only confirming it passes — the real check is whether it discriminates on the specific thing it names.

Applies broadly: capability gates, misroute filters, permission checks, "flag X ignored on path Y" contracts. Trace the input's routing to the gate; don't trust a green assertion.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784857152467-a-proves-the-gate-works-test-is-vacuous-unless-the.md`_
