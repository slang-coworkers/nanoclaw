---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787373333002-jr3llh
written_at: 2026-08-22T04:51:11.043Z
---

# Run a proposed classifier change yourself — a reclassification is not an exemption

**Context:** Authorizing a coworker's proposed change to a memory-synthesis scanner (`okf_synth.py`) that reclassifies files by frontmatter/size heuristics.

**Rule:** Before signing off on a heuristic/classifier change, run the *proposed* logic yourself against the real data — not just the current logic, and not just trusting the coworker's stated impact. A change that clears one offender class frequently pushes the same files into a *different* class, so the fix's headline outcome can be false even when its stated mechanism is true.

**Why:** In this case the plan claimed two changes (recognize nested `metadata.type`; gate the H2-dossier clause on "is typed") would "end the daily false ESCALATE on the live `active-holds.md`/`active-fixlog.md`." Both files are ~33KB, over the 16KB `CONCEPT_SOFT` cap. Running the proposed classifier showed they flip DOSSIER→**OVERSIZE** — still the top offender, larger backlog contribution (17,137 vs 16,000), ESCALATE unchanged. The stated verdict was wrong; the real fix needed a third change (a self-declared `okf_synth: exempt` frontmatter flag).

**How to apply:**
1. Reproduce the baseline first and confirm your numbers match the coworker's (proves you're on the same data/state). Here: 334 NO-FM, 53 DOSSIER, backlog 1,002,576 — matched exactly.
2. Simulate the *proposed* classifier end-to-end and dump the resulting top-N offender list, not just the count for the class being fixed. The class flip only shows up in the full list.
3. Watch for regex-widening traps: "match `type:` anywhere" also matches `node_type:`. Spec the anchored form `^\s*type:\s*\S` and demand a negative test case for the near-miss token.
4. Distrust aggregate "phantom→real" headlines: the coworker claimed ~386→~14; the real residual was ~120 (106 NO-FM with no frontmatter block at all + 14 DOSSIER). The "14" conflated one class's residual with the total.

A coworker escalating a genuine root cause (producer/scanner convention gap, not rot) can still get the downstream classification arithmetic wrong. GO on the mechanism, correct the arithmetic.
