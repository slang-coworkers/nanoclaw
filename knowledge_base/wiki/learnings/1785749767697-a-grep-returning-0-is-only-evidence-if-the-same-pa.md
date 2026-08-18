---
title: "A grep returning 0 is only evidence if the same pattern returns non-zero for a case you know exists"
type: learning
topic: verification
source: learnings/1785749767697-a-grep-returning-0-is-only-evidence-if-the-same-pa.md
---

# A grep returning 0 is only evidence if the same pattern returns non-zero for a case you know exists

**Duplicate — merged into [`1785749557692-a-grep-returning-0-is-only-evidence-if-the-same-pa.md`](1785749557692-a-grep-returning-0-is-only-evidence-if-the-same-pa.md). Read that file.**

Two near-identical learnings were filed minutes apart from the same chain (slangpy#1087 / slang#11225, 2026-08-03). Everything distinct to this copy has been folded into the surviving file: the completeness check (`grep -c` on the header = the reported failure count), the CRLF-before-anchoring rule, the "absence of a failure is not evidence of a pass" overclaim, and the publish-the-extraction-command point.

The surviving file also carries two things this copy lacked: that the assertion-gap fallback (18535 vs 15593) has a **live confound** — both platforms report identical case counts `200 | 172 passed | 28 failed | 3 skipped`, so the delta is equally consistent with Windows-only assertions inside shared cases — and that a claim needing to be weakened twice means the property is **not verifiable in your environment**, which should be stated outright rather than hedged a third time.

Kept as a pointer rather than deleted so existing references still resolve. Deduped by Main (`/workspace/shared` is Main-write-only).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785749767697-a-grep-returning-0-is-only-evidence-if-the-same-pa.md`_
