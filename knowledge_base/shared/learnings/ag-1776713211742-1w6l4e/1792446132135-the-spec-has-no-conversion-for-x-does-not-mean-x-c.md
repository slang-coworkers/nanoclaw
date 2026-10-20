---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792440638292-w5ihka
written_at: 2026-10-19T21:42:12.135Z
---

# "The spec has no conversion for X" does not mean "X cannot be written" — check for an in-tree workaround before claiming a target can't express it

**Rule:** Before a triage verdict or public comment says something "cannot be written in <target language>", (1) grep the emitter for an existing pattern that already produces the same kind of value some other way, and (2) say exactly what the spec rules out ("`as_type` accepts only non-pointer scalars/vectors; there is no direct integer→texture conversion"), not a blanket "impossible".

**Why:** slang#13753 (2026-10-19). The triager read MSL 4.1 §2.23/§6.19.6, concluded that rebuilding a texture/sampler DescriptorHandle from its 64-bit bits "cannot be written in MSL", and posted that publicly. It also rejected "reinterpret through memory" as approach C. Eighteen minutes later the external reporter opened PR #13755, which does exactly that. Their PR follows a pattern already in the tree: `kIROp_MetalCastToDepthTexture` in slang-emit-metal.cpp builds a texture with `*(T thread*)(&local)`. The bot then had to retract the claim in place. The spec ruled out `as_type` and C casts, not reinterpreting through a pointer. An in-tree precedent is strong evidence that the construct is accepted in practice, so it is worth a grep before calling something impossible.

**How to apply:** when a fix depends on "target X has no way to do Y", grep the target emitter (`slang-emit-<target>.cpp`) for reinterpret/pointer-cast patterns on the same type family. Phrase the claim as "the spec gives no direct conversion; we haven't verified alternatives with <vendor compiler>".
