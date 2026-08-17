---
title: "Surfacing verified counter-evidence to a maintainer can reverse a by-design ruling — don't silently accept OR unilaterally overturn"
type: learning
topic: verification
source: learnings/1785278991541-surfacing-verified-counter-evidence-to-a-maintaine.md
---

# Surfacing verified counter-evidence to a maintainer can reverse a by-design ruling — don't silently accept OR unilaterally overturn

**Context:** shader-slang/slang#12226 — bindless `ConstantBuffer<T>` via descriptor heap emitted as a StorageBuffer descriptor instead of Uniform. Maintainer jkwak-work initially ruled it **by-design** (citing an #11483 constraint: "if Uniform, SPIRV doesn't allow a pointer to an array element") and offered a workaround flag. The reporter then rebutted with a glslang `GL_EXT_descriptor_heap` shader showing a Uniform heap buffer indexing a nested array, accepted by spirv-val.

**The full arc:** external report → reproduced → maintainer ruled by-design → reporter rebutted with concrete counter-evidence → our fixer's investigation confirmed the mechanism → surfaced back to the maintainer → **maintainer retracted his own prior ruling ("I got it wrong on #11483"), prototyped the fix himself, and greenlit the bot to open the PR (#12256), which he then approved and self-merged.** A bug that looked terminally closed became a shipped fix.

**The reusable process rules that made this work:**
1. **A maintainer's by-design ruling is authoritative but not immune to new evidence.** When a reporter contests it with something substantive (not a restatement), that's a RE-OPEN trigger, not a re-close. Record that trigger explicitly when you first park the chain ("flag fails / fresh substantive input → RE-OPEN") so future-you acts on it instead of no-op'ing a "looks done" chain.
2. **Verify the counter-evidence yourself before relaying it.** The reporter and the fixer were both right here, but I re-emitted the repro at HEAD and independently confirmed the two load-bearing findings (the workaround flag doesn't change the descriptor *kind*; the StorageBuffer flip is over-broad) before putting them in front of the maintainer. Relaying an unverified refutation to a maintainer as fact is how you lose credibility.
3. **Neither silently accept the ruling NOR unilaterally overturn it.** The move is: verify → surface the refutation back to the *maintainer who made the call*, framed as their design decision to revise, with options (full fix / narrow interim / hold). @-mention them. Let them re-rule. Overturning a maintainer's ruling yourself — even when you're right — is out of bounds; surfacing verified evidence that leads them to reverse themselves is exactly right.
4. **Carry hedges honestly through the reversal.** DeepWiki had claimed the two SPIR-V storage-class operands "must match" (would've killed the fix); I'd flagged that as hypothesis, then verified against the actual spec that they're independent — and corrected my own earlier public "infeasible" statement in place rather than letting it stand.

**Guardrail that held throughout:** bot opens the PR DRAFT/creation-only; ready+merge stayed maintainer-gated. "Please make a PR" authorizes creation, not auto-merge. The maintainer self-merging fully satisfies the merge gate. Also: when the fix can't be fully verified compiler-side (here, a GPU runtime readback), state the gap explicitly in the PR description as a human-verification step — don't paper over it; the maintainer closed it by asking the reporter to pull-test.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785278991541-surfacing-verified-counter-evidence-to-a-maintaine.md`_
