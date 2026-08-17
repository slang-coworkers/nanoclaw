---
title: "[approver/critique-mustfix] a verified 🔴 cannot be downgraded to OPEN_GAP because 'it's only docs' — no documentation exemption in the 🔴 rule"
type: learning
topic: review-approval
source: learnings/1784440920822-approver-critique-mustfix-a-verified-cannot-be-dow.md
---

# [approver/critique-mustfix] a verified 🔴 cannot be downgraded to OPEN_GAP because "it's only docs" — no documentation exemption in the 🔴 rule

**Symptom:** slang#11803 R3 — the fixer resolved the R2 fxc code regression, but the SAME fix left its own public-API `@remarks` (hlsl.meta.slang:471/6463) claiming chunking "applies on every target, including HLSL (e.g. two `.Load<float2>`)" — now false for fxc/DX≤5.0, which the fix scalarizes. Devin flagged it under `## Bugs` (🔴). I VERIFIED it against source (real, reachable, PR-introduced), then drafted the decision as **ABSTAIN_POLICY (OPEN_GAP)** on the reasoning "it's a doc-precision issue, not a code-correctness 🔴 — the compiled output is correct, so below the BLOCK bar." The DECISION_REVIEW critique returned must-fix: that is an **unsupported scope reduction**.

**Root cause of the error:** the decision procedure says "any 🔴 Bug => BLOCK" and "investigation can only add caution, never upgrade a doc's 🔴 toward approval." There is NO documentation-vs-code severity carve-out in the 🔴 rule. Once the challenger has CONFIRMED (not refuted) a 🔴, moving it from BLOCK to ABSTAIN is precisely the "upgrade toward approval" the rule forbids — and "it's only docs / no functional defect" is exactly the plausible-sounding rationalization the rule exists to stop. Severity-based clearing applies to 🟡 GAPS (the conservative-lean rubric), NOT to a confirmed 🔴.

**How to catch it (self-check before recording):** for every finding I'm about to route to ABSTAIN/OPEN_GAP, ask: "did I CONFIRM this or REFUTE it?" If confirmed and it's a 🔴 → BLOCK, full stop. OPEN_GAP is for 🟡 gaps I judge inconsequential, or 🔴s I could neither confirm nor refute (CHALLENGER_CONCERN). A 🔴 I verified as REAL is never an OPEN_GAP, regardless of whether it's in docs, comments, a test, or code. The only path from a confirmed 🔴 to non-BLOCK is genuine REFUTATION (showing it's not real / not reachable / not this revision), not reclassification by severity.

**Fix:** corrected to BLOCK (RED_BUG). Related: the DECISION_REVIEW critique gate is what caught this — a reminder that the gate is a real backstop against my own rationalization, not a rubber stamp.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784440920822-approver-critique-mustfix-a-verified-cannot-be-dow.md`_
