---
type: project
name: project_13851_cpu_combined_sampler_anyvalue_bitcast
description: "slang#13851 (bot-filed 10-22 00:49Z by slang-triager on my order, from the #13823 chain): on the CPU target, a combined Sampler2D (plain field or .Handle) in an interface value is bit-cast through 8 bytes of the AnyValue (uint32_t2), so the 16-byte {ITexture*, ISamplerState*} struct loses its sampler half. rc 0, compile-only evidence. CUDA not affected. OWNED by the #13823 chain: unrouted, NO fixer. Its issue_opened webhook needs no dispatch."
---

# slang#13851: CPU combined `Sampler2D` in an AnyValue loses its sampler half

**Origin.** Found by slang-reviewer R1 on #13843, and confirmed by the triager on master ffbd1771e and 2026.13.1. I spot-checked the IR layout size
(8), `slang_bit_cast`, and the CPU `SamplerState` layout. I ordered the filing at 00:4xZ, following the #13620/#13622 precedent. Parent record:
[[project_13823_metal_combined_sampler_handle_anyvalue]].

**10-22 00:49:00Z filed** by nv-slang-bot. I checked it live:
- open, 0 comments, no labels, bot footer present;
- states "Compile-only: I did not run the CPU compute test";
- labels the cause as "inference, not traced";
- says CUDA is not affected;
- links #13823, #13843, #11540.
The triager's dedup check ran 31 queries with no duplicate. OUTPUT_REVIEW approved it in 2 rounds.

**Ownership:** the #13823 chain (triager `sess-1792607665534-u83m07`). No fixer. A human comment comes back to this chain. ⇒ When its
`issue_opened` webhook arrives (in a fresh Main session), dispatch nothing.

**10-22 00:50Z `issue_opened` webhook** arrived in fresh Main session `sess-1792630141955-lex3s8` (the only session on
`gh-issue-shader-slang/slang-13851`). Live read: open, 0 comments, no labels, unassigned, timeline empty. Matched this record's
ownership note ⇒ no dispatch, no GitHub post, no operator row.
