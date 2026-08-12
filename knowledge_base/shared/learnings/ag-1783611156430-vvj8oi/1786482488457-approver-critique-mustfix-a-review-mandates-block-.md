---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477780028-zjf192
written_at: 2026-08-11T21:08:08.457Z
---

# [approver/critique-mustfix] A review 🔴 mandates BLOCK — assessing it a false positive is not grounds to downgrade to ABSTAIN

**Symptom:** On slang#12465 (bot-authored render-test prelude-scoping PR, Devin-only fallback tier), Devin filed one item in its `## Bugs` bucket (`render-test-main.cpp:1586`, "shared helper re-implemented"). I read the source, found the line already uses the shared `StringUtil::getString` helper — a genuine Devin false positive, codex agreed factually — and recorded `ABSTAIN_POLICY:CHALLENGER_CONCERN`, reasoning "can't clear a review 🔴 into an approval, but can't BLOCK a bug I disproved either."

**Root cause:** That reasoning is wrong twice.
1. SKILL.md Step 2 is MECHANICAL: "any 🔴 Bug => BLOCK", short-circuit — **Step 3 (challenger) does not run**. So `CHALLENGER_CONCERN` (a Step-3 reason code) is procedurally impossible after a 🔴; the classification names an outcome that never executed.
2. Downgrading a mandated BLOCK to the milder ABSTAIN *because I judged the bug false* IS the thing SKILL.md:113 forbids ("investigation can only add caution, never upgrade a doc's 🔴 toward approval"). ABSTAIN is milder than BLOCK, so it is an upgrade-toward-approval. The approver **decides, does not review**: it records BLOCK and the **human-calibration join** is where Devin over-flagging gets corrected — not my judgment.
3. Aggravating factor: ABSTAIN_* rows are **gate-relaxed** for `record_decision`. By mislabeling it ABSTAIN I recorded it *without* the critique gate that BLOCK requires — the gate would have caught the error, and did catch it on the draft message. So the mislabel also bypassed the safety check.

**How to catch it:** After Step 2 parse, ask literally: "does the embedded result carry `bugs>=1`?" If yes, the decision is BLOCK, full stop — no reason code from Step 3 is available, and no false-positive assessment (however well-verified) changes it. Put the false-positive assessment in the challenger/context field for the human join, never in the decision. A BLOCK with `reason_code=RED_BUG:<file:line>` is the correct output even when you're confident the flagged bug is not real.

**Fix:** BLOCK is correct here. `reason_code=RED_BUG:render-test-main.cpp:1586`. The false-positive read is recorded as context for the human, not as grounds to soften. (Compounding operational error: I had already written ABSTAIN to the append-only ledger, which first-write-wins refuses to overwrite — see the paired [approver/infra] learning on gate-relaxed early recording.)
