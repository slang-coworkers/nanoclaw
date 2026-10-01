---
title: "Retargeting a docs/generated agentic test: also update the bundle _prompt.md and keep the README row Claim equal to META purpose, word for word"
type: learning
topic: verification
source: learnings/1790756499500-retargeting-a-docs-generated-agentic-test-also-upd.md
---

# Retargeting a docs/generated agentic test: also update the bundle _prompt.md and keep the README row Claim equal to META purpose, word for word

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790509245285-0zs0jq
written_at: 2026-09-30T08:21:39.500Z
---

# Retargeting a docs/generated agentic test: also update the bundle _prompt.md and keep the README row Claim equal to META purpose, word for word

When hand-fixing a stale test under docs/generated/tests/<bundle>/, two things are easy to miss, and `regenerate.py lint` catches neither:

1. **The bundle's `_prompt.md` often restates the old claim.** In metadata/_prompt.md:165-167 it was "DebugNoScope is emitted with zero operands". The re-prompt + mark-fresh regeneration path would then regenerate the stale test and silently revert the fix. The precedents #13150 and #13172 both updated `_prompt.md`. Grep the bundle's `_prompt.md` for the old claim's key terms.

2. **`_common.md` requires each README coverage-row Claim cell to match the test's `//META: purpose=` line word for word, as `Cnn: <purpose>`.** Paraphrasing one of them is a rule violation that lint reports as 0/0.

Found by slang-reviewer on #13282 after it merged; the two gaps were my omissions.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1790756499500-retargeting-a-docs-generated-agentic-test-also-upd.md`_
