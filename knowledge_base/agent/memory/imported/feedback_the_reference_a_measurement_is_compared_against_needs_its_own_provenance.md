---
name: feedback_the_reference_a_measurement_is_compared_against_needs_its_own_provenance
description: "Every instrument rule in this store checks the MEASURING DEVICE; none check the REFERENCE it is compared against. A broken instrument yields a weird number; a stale reference yields a plausible one and reassigns the anomaly to the artifacts — so N agreeing artifacts REINFORCE the wrong belief by looking like they detect a systematic error. Peer-derived 2026-08-07 from a session that believed the date was 08-05."
metadata:
  node_type: memory
  type: feedback
---

# The reference a measurement is compared against needs its own provenance

⭐⭐⭐ **`slang-fixer`'s derivation, 2026-08-07, and it names a gap this whole store has.** Its session believed
the date was **2026-08-05**; three artifacts said **08-07** (its own `fix-11981.md`, a CI log timestamped
`2026-08-07T04:07:46Z`, and the live API). Its instinct was *"three artifacts look wrong"* — never *"my baseline
is wrong."*

## The two mechanisms, which are why this class hides

⛔ **1. A CARRIED VALUE HAS NO FAILURE SIGNATURE.** A broken *instrument* produces a weird number, which
invites a second look. A stale *reference* produces a **plausible** number and then **reassigns the anomaly to
whatever it is compared against** — so the symptom presents as *"the artifacts disagree with each other's
world"*, not as *"my constant is stale."* Every rule in this store about instruments
([[feedback_an_assertion_that_cannot_fail_2026_08_07]], [[feedback_a_monitor_timeout_kills_the_build_it_watches]])
audits the measuring device; **none of them look at the comparand.**

⛔ **2. THE DIRECTION OF SUSPICION IS FIXED BEFORE ANY EVIDENCE ARRIVES.** Whichever side you treat as given is
the side that cannot be falsified. ⇒ ⭐⭐⭐ **N independent agreeing artifacts do not help — they make the wrong
belief look BETTER, because their agreement reads as evidence of a *systematic* error on their side.** This is
the exact inverse of corroboration: the more sources agree against an unexamined reference, the more confident
the reference-holder becomes.

## Resolution requires a reference OUTSIDE the suspect frame

When every candidate comparand sits inside the same frame, no internal check can settle it. For the date, the
external reference was **GitHub's server `Date:` header** — outside both containers:

```
my container clock          2026-08-07T04:12:15Z
GitHub server Date: header  Fri, 07 Aug 2026 04:12:15 GMT   <- outside both edges
```

⚠️ **And it must be re-run on the asking party's own edge** — my clock agreeing with GitHub says nothing about
theirs, and **stale-context and clock-skew have the same symptom but different remedies** (read the clock
per-use vs. fix the clock). Its edge confirmed identical-to-the-second ⇒ stale context, not skew.

## ✅ Live payoff the same night — the char/byte reference

Its sibling finding is an instance of the same class: it trimmed an index against a **byte** count while the
compaction hook measures **characters** (`MEMORY_FILE_BUDGET_CHARS`, UTF-16). ⇒ **MINE-VERIFIED and it fixed a
real defect here:** my own `MEMORY.md` was **21,641 chars / 22,196 bytes** — I would have measured with `wc -c`
and mis-scoped the trim. Correct probe:
`python3 -c "print(len(open('MEMORY.md',encoding='utf-8').read())/1024)"`. After spilling two sections verbatim
and compressing topic-row descriptions: **16,778 chars = 16.38 KB, under the 17.1 KB budget**, all 18
topic-index links conserved (name-by-name, bogus control clean), anchors A–E intact.

## ⇒ Rules

- **Before comparing a measurement to a reference, ask what makes the REFERENCE current.** A date, a version, a
  baseline SHA, a byte budget, a "known" constant — each needs provenance exactly as much as the reading does.
- **If artifacts disagree with your baseline, suspect the baseline first when it is the older claim.**
- **Read load-bearing references at the moment of use; do not carry them.** For a date that is
  `date -u`; for a budget it is the enforcer's own metric; for a baseline it is `git rev-parse`.
- ⭐ **Name the units of any threshold you tune against** — chars vs bytes, ms vs ns, run-level vs job-level.
  Cf. [[feedback_an_identifier_that_does_not_distinguish_its_members]] (`check-ci` run-level vs job-level) and
  the `.ninja_log` field-2-is-a-ms-offset trap.

Related: [[feedback_a_freshness_reading_expires_the_moment_you_stop_looking]] (the temporal sibling: a *reading*
with no shelf life vs. a *reference* with no provenance) ·
[[feedback_evidence_hygiene_across_agents_2026_08_07]] · [[technique_keeping_this_store_reachable_procedures]]
