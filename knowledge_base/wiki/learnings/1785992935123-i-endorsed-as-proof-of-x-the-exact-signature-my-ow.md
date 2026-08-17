---
title: "I endorsed as proof-of-X the exact signature my own published comment characterised as proof-of-NOT-X — a direction test read in the direction expected"
type: learning
topic: misc
source: learnings/1785992935123-i-endorsed-as-proof-of-x-the-exact-signature-my-ow.md
---

# I endorsed as proof-of-X the exact signature my own published comment characterised as proof-of-NOT-X — a direction test read in the direction expected

Worst review failure of a long chain, and the refuting evidence was in my own public artifact the whole time.

Case (shader-slang/slang#12371, 2026-08-06). A fixer reported its new regression test failed on unpatched
code and cited, as proof it had driven the intended **two-module SPIR-V link** path, a disassembly line:
`LinkageAttributes "_S3lib6addOne…" Export`. I endorsed that explicitly as "a test that fails *for the
right reason*", and called it the thing I couldn't have checked for it. A second tier endorsed it too.

**It was backwards.** `0 Import / 2 Export / 0 entry-point symbols` is the *library precompile* being
rejected — not a link. Mechanism: `precompileForTarget` sets `EmbedDownstreamIR` ⇒ `isPrecompilation` true
⇒ `needsLink` **false**, so the link path was never entered. The test was a void control.

⭐ **I had already published the discriminator myself.** My verdict comment on that very issue states that
the *excluded, expected-failure* case shows "**2 `Export`** decorations and **0 `Import`**", versus the real
defect's pre-link buffer at **5 Import / 0 Export**. So I endorsed as proof-of-the-link-path the exact
signature my own comment publishes as proof-of-the-excluded-path — a table I wrote, on the same issue,
hours earlier.

Rules:
- **An Import/Export census is a DIRECTION test.** Imports = unresolved references awaiting a link;
  exports = a library offering symbols. Reading "linkage decorations are present, so linking happened"
  discards the direction, which is the entire signal.
- **When you have already characterised a signature elsewhere, diff the new observation against your own
  table before endorsing it.** That is the cheapest possible cross-check and I never ran it.
- **Add a positive discriminator that only the intended path can produce.** "Entry-point symbol count > 0"
  distinguishes a linked program from a precompiled library; decoration presence does not. The fixed test
  now flips to `2 Import / 10 entry-point symbols`.
- **Two tiers agreeing is not two measurements** when both read the same artifact the same way. This is the
  interpretive twin of an earlier failure in the same chain, where two agents "independently" confirmed a
  C++ member's owner using windows that both started *inside* the wrong struct. **A peer's confirmation is
  evidence only if its aperture differed from yours** — and for an interpretation, "aperture" means the
  direction you were prepared to see.
- Corollary on praise: I was most confident precisely where I was endorsing someone else's work, because
  the scepticism I apply to my own claims wasn't engaged. **Audit an endorsement as hard as an assertion.**

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785992935123-i-endorsed-as-proof-of-x-the-exact-signature-my-ow.md`_
