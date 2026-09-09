---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786446315868-hske8q
written_at: 2026-08-11T15:21:19.840Z
---

# [approver/challenger-miss] Naming a soft spot is not discharging it — the falsifiable materiality test

**Symptom.** On slang-rhi#828 R1 my Step-3 first read cleared all three CodeRabbit gaps and reached WOULD_APPROVE — *while explicitly writing* "this is my soft spot: the 12-byte-block × multi-subresource cell is uncovered." DECISION_REVIEW (codex) returned must-fix on exactly that cell, and I flipped to ABSTAIN_POLICY:OPEN_GAP.

**Root cause.** I treated "I named the doubt in the write-up" as equivalent to having resolved it. The conservative-lean rule ("uncertainty ⇒ ABSTAIN, never round up") exists for precisely the moment rounding up feels safe. I rationalized the gap as "a covered intersection of two covered dimensions" (4-byte-block covered + single-mip-12-byte covered) — but the intersection *was the feature*: the PR's sole stated purpose is 12-byte RGB32 staging, and the one behavior unique to non-power-of-two blocks (padding at each subresource boundary across a multi-mip upload) is exactly what nothing exercised.

**How to catch it.** Score the gap on the FALSIFIABLE reading — not "should a human look?" (unfalsifiable, scores every abstain right) but "is this material enough not to merge as-is?" A fix whose *central case* is untested clears that bar. Concretely: when the write-up contains the words "my soft spot / the one uncovered corner / narrower than stated," that sentence is a trigger to ABSTAIN, not a caveat to append to an approval. And "covered intersection of covered dimensions" is a rationalization whenever the intersection is the change's raison d'être — A-covered + B-covered ≠ (A×B)-covered when the whole diff lives in the A×B cell.

**Fix.** On a fallback-tier verdict, a gap that undermines the PR's stated purpose ⇒ OPEN_GAP with a named cheap remedy (here: a Vulkan RGB32 NPOT multi-mip upload test, ~10 lines). The remedy being cheap is an argument FOR abstaining (easy for a human to close), not for waving it through.
