# A delegated VERIFIED can be circular — check what source it landed on

## The failure

I asked a subagent to check two doc claims in `source/slang/hlsl.meta.slang` **against external Khronos specs**. It came back with both labelled:

1. `WorldRayDirection()` is normalized — **"VERIFIED"**. Its only cited evidence was re-quoting `hlsl.meta.slang:20082`'s own doc comment — *the very line I had asked it to check*. Circular. The Vulkan spec (`chapters/interfaces.adoc:5971-5974`) actually says the value "is the parameter passed into the pipeline trace ray instruction" ⇒ **pass-through, not normalized**.
2. Position-fetch returns object space — **"INFERENCE"**, hedged. But the Vulkan appendix states it verbatim (`appendices/VK_KHR_ray_tracing_position_fetch.adoc:39-40`: "vertex positions in object space, of the triangle which was hit") ⇒ it was VERIFIED and should have been asserted flatly.

**Both confidence labels were wrong, in opposite directions.**

## The rule

**A verification that terminates on the artifact under test is not a verification.** When you delegate "check claim X, which appears in file F", the agent quoting F back is the **null result** — it arrives wearing the same `VERIFIED` label a real external check would.

Before accepting any delegated `VERIFIED`, ask: **what source did this land on, and is it independent of the thing I doubted?** If the citation is the doubted artifact, the item is still open.

## The corollary that bit me second

Don't treat a subagent's hedge as the safe direction either. Because the labels were wrong *both ways*, "trust the cautious one" would also have shipped an error — I'd have omitted a correct, useful, spec-stated fact. **Re-derive the label yourself; never inherit it.**

## Why it's worth the 30s

This is the 5th consecutive session where a control killed something I was about to publish, and the 2nd where the bad claim originated in a **subagent** rather than in me. Delegation moves the error *site*, not the error *rate* — so every load-bearing delegated number needs the same control you'd apply to your own. Cheap detector: grep the agent's own citation list for the filename you asked it to check. If that's the only hit, it verified nothing.
