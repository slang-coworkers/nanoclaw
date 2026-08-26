---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787663518966-3m888s
written_at: 2026-08-25T13:41:02.785Z
---

# [approver/clause-gap] A broad PR title + a triage that named sibling fixes turns a 'pre-existing untouched' gap into OPEN_GAP

**Symptom:** slang#12733 "Fix Metal pointer cast precedence" guards ONLY the `kIROp_BitCast` arm in `slang-emit-metal.cpp` with precedence-aware parens, and ships a correct discriminating regression test. Two sibling pointer-cast arms in the SAME switch — `CastDescriptorHandleToUInt64` (:842-848, emits `(ulong)(x)`) and `CastUInt64ToDescriptorHandle` (:850-858, emits `(pointer-type)(x)`) — carry the identical unguarded C-style cast. My first instinct was to CLEAR the bot's 🟡 gap as advisory: "pre-existing, untouched by the diff, out of scope." The critique gate correctly pushed back and I revised to ABSTAIN_POLICY / OPEN_GAP.

**Root cause of the misjudgment:** "Pre-existing and untouched by the diff" is a strong reason to clear a gap ONLY when the gap is also out of the PR's stated scope. Two facts flipped it here: (1) the PR TITLE asserts the *general* fix ("Fix Metal pointer cast **precedence**", not "fix bit_cast precedence") — leaving 2 of 3 pointer-cast arms unguarded undermines the stated purpose; (2) the linked issue #12732's triage comment EXPLICITLY recommended guarding all three cast paths and named the siblings by line. When a maintainer/triage has already scoped the fix to include the siblings, shipping one-third of it is a scope question a human must resolve, not a nit. And I could not prove `CastUInt64ToDescriptorHandle`'s pointer-typed base is unreachable as a `->`/subscript base — the exact shape that produces the reported invalid MSL. Plausible real trigger + relevant to stated purpose + can't prove inconsequential ⇒ ABSTAIN.

**How to catch it (transferable):** For an emit/codegen fix that touches ONE arm of a switch/if-chain where structurally identical sibling arms exist, run three probes before clearing the "you didn't fix the siblings" gap: (a) does the PR TITLE/description claim the general fix or the narrow one? A general title makes sibling omissions purpose-relevant. (b) Does the linked issue/triage recommend fixing the siblings too? If yes, one-arm coverage is a scope decision for a human. (c) Can you PROVE the sibling's output can't reach the failing context (here: a pointer-typed base folded into a postfix operator)? If not, uncertainty ⇒ ABSTAIN. "Pre-existing + untouched" clears a gap only when NONE of (a)/(b)/(c) bite.

**Fix / rule:** "Pre-existing and out of scope" is TWO conditions, not one. Verify scope against the PR's own stated purpose AND against the linked issue's recommended fix — not just against what the diff physically touched.
