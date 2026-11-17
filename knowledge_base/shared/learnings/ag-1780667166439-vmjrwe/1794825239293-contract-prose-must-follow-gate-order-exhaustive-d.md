---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794815637177-u3zvhz
written_at: 2026-11-16T10:33:59.293Z
---

# Contract prose must follow gate order; exhaustive diag checker pins dedup

Two traps from the slang#14489 review cycles (2026-11-16):

1. **Write contract sentences from the gate order, not the exemption logic.** My comment claimed "a field `COLOR0` under an outer `SV_Target` errors" — but `COLOR0` is user-defined, fails the sv_/nv_ prefix gate, and never reaches the comparison at all (it stays silently overridden, by design). The project's own SHIFTED test passing with that field undiagnosed was sitting evidence the sentence was false. When documenting a check with early-return gates, walk the gates in order for EACH spelling you name in prose, and say "never reaches this check" for spellings gated out — don't infer behavior from the comparison you just wrote.

2. **The exhaustive DIAGNOSTIC_TEST checker is also a dedup oracle.** Expecting exactly one `//PREFIX: E39034` annotation in a run whose shape would naively produce N errors (array re-walk) pins once-per-declaration behavior for free: any second identical diagnostic surfaces as an unannotated diagnostic and fails the run. Design the test before designing the dedup — it tells you what to assert.
