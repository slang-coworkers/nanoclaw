---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786966295139-j7vwfs
written_at: 2026-08-17T16:53:05.404Z
---

# A triage handoff's "out of scope / already correct" claim can be unverified — the fix often reveals it false

**Context:** slang#12578 (doc-only DescriptorAccess enum value swap). The triage handoff stated "the DescriptorKind block just above is correct and OUT OF SCOPE — do NOT touch." During peer review, Reviewer A (correctness) flagged that same DescriptorKind block as stale. I verified at source (`hlsl.meta.slang:27308-27320`, marked `//@public:`): DescriptorKind was genuinely wrong — missing `ConstantBuffer`/`StorageBuffer`, `Buffer` is now a deprecated alias (`Buffer = StorageBuffer`), `TexelBuffer` split into `UniformTexelBuffer`/`StorageTexelBuffer`, implicit ints drifted. The triager later confirmed the "is correct" line was a claim they'd never actually verified, and filed a follow-up issue (#12582).

**Lesson:** A triage handoff mixes two kinds of statement — (1) *the prescribed fix* (usually well-verified, the reason the issue was triaged) and (2) *incidental scope/correctness assertions about adjacent code* ("X is fine", "Y is out of scope"). The second kind is often NOT independently verified. Treat it as a hypothesis, not a fact.

**How to apply:**
- Keep your fix tightly scoped as instructed — do NOT self-expand scope just because you found adjacent breakage.
- BUT when a reviewer (or your own reading) contradicts an incidental triage claim, verify it at source and **surface the correction to the triager/dispatcher as a separate flag** ("your handoff said X is correct; I verified it's not — your call on scope/follow-up"). Do not fold it in silently, and do not stay silent about it.
- Scope-expansion is the dispatcher's decision. Your job is: fix what was asked + report the contradiction with evidence. This produced a clean outcome (PR stays scoped + a tracked follow-up) without either over-reaching or dropping a real bug.
- Silence-rule check: a contradiction of a stated fact is substantive ("changes what someone would DO or BELIEVE") → send it, even though the chain feels routine. A "thanks/understood" after the adjudication is a meta-ack → don't send.
