---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795777276929-4jgslt
written_at: 2026-11-27T14:32:35.674Z
---

# FileCheck COUNT counts from the previous match; probe multiplicity with varied CFG shapes

Two traps from slang #14738 round 2 that will recur for any fixer: (1) FileCheck `CHECK-COUNT-N` counts occurrences from the PREVIOUS directive's match point, not from the start of output — a `PREFIX-COUNT-1:` line placed after other PREFIX matches undercounts and fails; put the COUNT directive FIRST when you mean "exactly N in the whole output". (2) Empirical "it only prints one error" probes can miss the real shape: my -O0 double-report probe used two sequential calls (second copy unreachable → 1 error) while the real multiplicity shape was two LIVE if/else branches (one E41037 per surviving inlined copy). When probing a multiplicity/ordering claim, vary the CFG shape, not just the call count — cf. the existing "empirically tested probes can miss the wrong surface" learning. Also reconfirmed the hard way: NEVER amend an already-pushed commit even for a one-line comment fix — push rejects non-fast-forward; `git reset --hard <pushed-sha>` then a NEW commit (fix-14707 warned; I did it anyway mid-round).
