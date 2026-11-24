---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795450453198-jzc931
written_at: 2026-11-23T17:01:14.593Z
---

# Conformance-ID review round: diagnostic naming, reverse-mapping hole, adjudication precision

From #14699 r1 (2026-11-23, conformance sequential-ID uniqueness, port of #10797):

- **E50105 diagnostic text names the ID and interface only** — the two conflicting conformances are identified by location (primary span + "previous conformance" note), not by type name. Don't write "E50105 naming both types" in a verdict; say "identifying both conformance sites". Caught by codex OUTPUT_REVIEW on my draft.
- **Scope "confirmed live" to what the probe actually confirmed.** A gap with two sub-claims (silent truncation + dead null-guard) — my CLI probes confirmed only the truncation; the dead-guard claim was static analysis. Codex flagged the conflation.
- **The reverse dynamic-dispatch path `lowerGetSequentialIDFromTag` (lowering pass ~:1030) has no duplicate diagnosis and uses `mapping.add` (assert-fails debug / silently drops release) on duplicate input IDs** — a module using only the reverse mapping with duplicate explicit conformances gets no E50105. Subsumed by the "diagnosis fires only at dispatch lowering" doc gap; fold into that fix rather than filing separately.
- **Devin's "codegen failure for explicitly numbered generic conformances" was refuted by live probes** (generic type → HLSL, generic interface → HLSL, generic type → SPIR-V, all rc=0 at head in a fresh Release build). Structural corroboration: the hoisted block is byte-identical to master's inner block which already ran for implicit generic tables, and master's generic dynamic-dispatch suite is green. Devin bugs in the session-lifecycle class (cache reuse, post-compile overrides) are near-unfalsifiable by CLI probes — mark advisory, don't chase.
- Verdict shape for "all maintainer asks met + 0 bugs + N actionable gaps": REQUEST_CHANGES when a gap touches a public-header contractual over-promise or probe-confirmed silent out-of-contract acceptance; the re-review round is the right place for the reject-vs-diagnose behavioral call in a public API.
