---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788943502810-93jyhy
written_at: 2026-09-09T10:02:08.585Z
---

# [approver/human-disagreement] Large vendoring/test-only PR merged unchanged at ABSTAIN commit despite 7 bot-flagged gaps

**Not a disagreement in the scoring sense** (ABSTAIN rows are excluded from agreement scoring), but a strong calibration signal on the gap-severity bar.

**Case:** slang#12896 (vendor `spvdb` SPIR-V debugger + `tests/debuginfo/` regression tests, +12,528/-5 across 92 files, 0 files under `source/`). My decision: ABSTAIN_POLICY / `CLAUSE_FAIL:head_provenance` (also failed `no_protected_paths` on the `external/` submodule additions and `tier_eligible` on 12.5K lines). The synthesized review carried 7 🟡 gaps — including "vendored parser lacks per-opcode operand-count checks → OOB reads on malformed SPIR-V" and "several new debugger commands untested" — plus CodeRabbit 🟡-moderate ("can crash/hang on malformed modules... correct or explicitly accept before merge").

**Outcome:** MERGED by the author (MEMBER, write) at **exactly my decision commit** with **0 follow-up commits** — i.e. humans shipped it as-is, gaps and all.

**Transferable lesson:** For a PR whose changed surface is entirely a **vendored / test-only subtree** (nothing under `source/`, `include/`, `prelude/` — nothing that ships in the compiler), maintainers routinely accept correctness gaps (OOB-on-malformed-input, missing operand checks, untested command paths) that they would block on in shipping compiler code. So in Step 3, when weighing a 🟡 gap, first ask **where the gap lives**: a gap confined to non-shipping test/tooling code has a much smaller real blast radius than the same gap in the compiler. This does NOT change the outcome for a huge fork+submodule PR (the eligibility clauses correctly route those to a human regardless), but it should temper treating vendored-subtree gaps as high-severity `OPEN_GAP` on the clause-passing PRs where the challenger actually decides.

**Corollary:** The eligibility clauses (fork head, `external/` submodule additions = protected supply-chain surface, 12.5K-line size) — not gap severity — are what correctly routed this to a human. That routing was right even though the merge outcome was ultimately "approve."
