---
title: "[approver/challenger] a standing bot 🔴 is REFUTED (not honored) when the flagged text/code no longer exists at the pinned head — verify against source both ways"
type: learning
topic: review-approval
source: learnings/1784442969985-approver-challenger-a-standing-bot-is-refuted-not-.md
---

# [approver/challenger] a standing bot 🔴 is REFUTED (not honored) when the flagged text/code no longer exists at the pinned head — verify against source both ways

**Symptom:** slang#11803 R4 (doc-only fix for the R3 doc 🔴). The fresh head-current Devin STILL listed the same 🔴 at hlsl.meta.slang:471 ("overstates … all HLSL profiles") even though the R4 commit rewrote exactly that `@remarks` wording. A naive reading — "Devin still flags a 🔴, and R3 taught me a verified 🔴 is BLOCK with no exemption" — would wrongly BLOCK a clean fix.

**Root cause:** Devin Review's bug list can LAG the latest commit — it re-renders slowly or keys off a cached/PR-description-derived analysis, so a bug it already surfaced persists in the list even after the code/text is fixed (observed twice this chain: R3-ef3ba2 and R4). The bug label is not a live re-assertion against the pinned head.

**The discriminator (this is the whole lesson):** whether a standing 🔴 BLOCKS depends on ONE thing — does the flagged defect actually exist in the source at the pinned head? Verify by reading/grepping the settled-head source, not by trusting or distrusting the bot label:
- R3: I fetched hlsl.meta.slang and the overstatement ("every target, including HLSL") WAS present → CONFIRMED → BLOCK.
- R4: I fetched the same file; the overstatement was GONE (grep "every target"/"all HLSL" = empty), replaced by an accurate fxc caveat matching the code → REFUTED → does not block.
Both decisions are the same operation (check the source fact), yielding opposite results because the source changed. This is NOT the R3 error (downgrading a CONFIRMED 🔴 by severity) — refuting a 🔴 that is absent from source is legitimate and required; honoring a bot label for a defect that no longer exists would be a false-BLOCK.

**How to catch it:** for any standing bot 🔴 on a revision that claims to fix it, re-fetch the exact file:line at the pinned head and confirm whether the flagged text/pattern is still there. Grep for the specific phrase the finding names. A "Resolved" tag from the same bot (Devin marked legalize.cpp:777 "Resolved" here) and Informational notes affirming the fix are corroborating, but the source read is authoritative. Refute only on a source fact; never on "the author says they fixed it."

**Fix:** WOULD_APPROVE (CLEAN) — first non-BLOCK in a 4-revision chain (R1 BLOCK → R2 BLOCK → R3 BLOCK → R4 approve). Companion to [[a verified 🔴 cannot be downgraded to OPEN_GAP because it's only docs]] (R3): that rule forbids downgrading a PRESENT 🔴; this one permits refuting an ABSENT one — the pin is always the source at the head.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784442969985-approver-challenger-a-standing-bot-is-refuted-not-.md`_
