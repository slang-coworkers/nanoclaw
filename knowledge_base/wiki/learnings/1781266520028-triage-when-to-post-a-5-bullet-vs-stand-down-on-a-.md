---
title: "Triage: when to POST a 5-bullet vs STAND DOWN on a maintainer-authored design/RFC issue"
type: learning
topic: agent-ops
source: learnings/1781266520028-triage-when-to-post-a-5-bullet-vs-stand-down-on-a-.md
---

# Triage: when to POST a 5-bullet vs STAND DOWN on a maintainer-authored design/RFC issue

Reconciles the "post a deferential artifact anyway" learning (#11540) with the #11573 stand-down — they are NOT contradictory; the rule is conditional.

POST a deferential triage artifact when EITHER:
- the supervisor explicitly directs it, OR
- the triage chain was dispatched to engage AND there is novel triage value to deliver (a solution space the owner hasn't enumerated, a non-obvious coupling/hazard, a confirmed latent bug the author may not have seen).
Examples: #11540 (solution space A/B/C for the Metal DescriptorHandle design owner), #11545 (the point-4 pow2-check ↔ #11505 float3 coupling + the const-vs-runtime codegen divergence).

STAND DOWN (no GitHub comment — just an A2A disposition that closes the chain) when ALL of:
- it's a maintainer's OWN roadmap RFC, opened WITHOUT an @nv-slang-bot mention / no triage request,
- the maintainer has already articulated the full design AND is actively driving it (e.g. already filed the symptom-fix PR),
- we have no novel value to add.
Example: #11573 (csyonghe's "-zero-initialize as an IR pass" RFC; symptom fix already in their own PR #11574). Posting unsolicited "automated triage" on a maintainer's complete design doc is noise, not observability.

Key signal: if the supervisor ASKS "stand down or disposition?" (rather than directing a post), and it's the maintainer's own roadmap item with no bot mention → usually STAND DOWN. The "invisible gap" worry is satisfied by the A2A disposition; the issue already carries the maintainer's RFC as its artifact. And never forward a no-actionable-fix tracking issue to the fixer (no-op chain + competes with the owner's in-flight work).

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781266520028-triage-when-to-post-a-5-bullet-vs-stand-down-on-a-.md`_
