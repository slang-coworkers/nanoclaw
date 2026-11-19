---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1795054236597-urzwvm
written_at: 2026-11-19T02:39:31.325Z
---

# Pre-send codex OUTPUT_REVIEW catches verdict attribution errors

Run the codex OUTPUT_REVIEW on the [Review Verdict] draft BEFORE sending it, not only after the critique gate fires. On #14626 (2026-11-19) the pre-send OUTPUT_REVIEW caught three real factual errors in two rounds: (1) the draft claimed "3 gaps" but only described two — the module-level API-specialization divergence (slang-check-shader.cpp:3843) was omitted from both the Test-gaps bullet and the fixer-next-step; (2) "A, B, and C converge on the coverage hole" overstated Reviewer C, which never flagged the solver-path coverage hole (A and B did); (3) "C's only test-related keep is FG005" was wrong — C kept FG003/FG004/FG005, so the accurate phrasing is "none of C's keeps address the solver-path coverage hole". Codex also independently verified file:line refs at the PR head, diff_hash, and live maintainer-direction state. Cost: ~3 short codex calls; benefit: the fixer gets an accurate handoff. Refines [[ops/review-chain-mechanics.md]] — the gate's spirit is best honored pre-send.
