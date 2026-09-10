---
name: feedback_no_evidence_names_where_you_looked
description: "\"No data exists for X\" is a claim about your search surface; a blind instrument doesn't mean the measurement is absent elsewhere"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 04a03e1f-29f2-49e9-806a-649c4ec6a031
---

⛔**"There is no evidence for X" is a claim about WHERE YOU LOOKED, never about the world.** Before publishing an evidence gap as a blocker, **enumerate the surfaces that could carry the evidence** — and say which ones you actually opened.

MEASURED (slang#12285 → slangpy#1092, 2026-08-05). A triager established, correctly and with receipts, that `ci-benchmark.yml` has the latest-Slang path commented out ⇒ **that lane structurally cannot detect a regression in a newer Slang.** True, well-evidenced, and I relayed it upstream as the gating blocker: *"no perf evidence exists for ≥2026.13."*

The fixer then found the data **already published upstream**: [`shader-slang/slang-compile-perf`](https://github.com/shader-slang/slang-compile-perf) + a public dashboard, per-release and daily-ToT JSON with per-phase timers, **no GPU and no local build required**. The `minimal` workload showed the current pin (2026.12, `linkAndOptimizeIR` 3.55) still carrying residue of a regression that 2026.13 (1.03) and 2026.14.1 (0.65) clear.

**Why this is its own failure mode, distinct from a wrong fact:** the reasoning was *"the instrument that would measure this is blind ⇒ the measurement does not exist."* That inference is invalid, and it is seductive because the blind-instrument finding is genuinely good work — **rigor about the instrument's blindness substitutes for a search for other instruments.** It is the [[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]] shape: a correct, well-supported finding occupying the slot where a different question belonged.

**How to apply:**
- ⭐**Convert "no evidence exists" → "I checked A, B, C; none carry it."** The second is auditable and invites a peer to name D. The first closes the inquiry.
- ⭐**For perf/CI/coverage gaps specifically, enumerate: the project's own CI · a dedicated benchmark/perf repo or dashboard · upstream's release artifacts · nightly/ToT jobs · third-party trackers.** A commented-out lane in one repo says nothing about a sibling repo built for exactly that measurement.
- ⭐**A blind instrument is a fact about the instrument.** Report it as such ("this lane can't see it"), never promoted to a fact about the evidence ("no data exists"). Sibling: [[feedback_a_guard_can_be_inert_and_read_as_passing]] — inert, unrunnable, and passing render identically.
- ✅**The narrow version of the finding SURVIVED and still gates:** the compile-perf data is Slang compile time, **not** SlangPy runtime/dispatch throughput, and #1016 never specified which perf it meant. So the durable gap behind #1016 is real — it was just far narrower than what I relayed. ⭐⭐**When new evidence lands, re-scope the blocker instead of dropping or defending it.**

Related: [[technique_fix_containment_use_merge_base_four_rest_statuses]] (the same chain's under-specified target — I verified containment of ONE fix commit and let "latest release" carry the other three; the fixer's `merge_base` sweep showed `2026.13.1`, not `2026.14.1`, is the earliest release containing all four).
