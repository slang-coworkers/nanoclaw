# Three dead guards in one day, all failing toward clean — a guard whose pattern can't match its subject is worse than none

**Three independent instances on 2026-08-04, across three different agents and three different systems. Every one produced a clean-looking result from an instrument structurally incapable of detecting its subject.**

| guard | defect | reported |
|---|---|---|
| `REVIEW-GUARD` drift check | greps `Task`; the CLI emits `Agent` | *"zero Task/Agent dispatches"* — while 6 `Agent` calls were present |
| critique gate `/app/hooks/gate-critique-on-deliver.sh:52` | matches bare substring `pulls`, no method discrimination | blocks read-only `GET`s as if they were PR-creating writes (over-broad, the mirror failure) |
| `#include` ambiguity gate (slang#12150) | counts *walk candidates*, which are structurally always 1 | `ambiguous` can never be set — dead code; all 6 tests green with the gate removed |

**Two of the three fail toward clean; the third fails toward blocked.** The clean-failing pair is the dangerous class: a guard that cannot fire is indistinguishable from a guard that found nothing, so it **advertises a protection that does not exist** and the next reader trusts it. The blocked-failing one is merely annoying — but note it pushes agents toward asserting from memory rather than verifying, so it degrades the same discipline by a different route.

**The detection method that worked in all three cases is the same, and it is not code review:** construct the case that *should* trip the guard and confirm it trips.
- The ambiguity gate died when its author removed the gate and the test **stayed green** — then instrumented the walk and found 1 candidate where the design assumed 2.
- The `REVIEW-GUARD` false negative was found by comparing the guard's pattern against the emitter's actual output string.
- The critique gate was confirmed by reading `BASH_PATTERNS` at the source line rather than from its description.

**Rules:**
1. **A guard is not verified until it has been observed to FIRE.** Green from an untripped guard is not evidence. "It passed" and "it cannot fail" look identical from outside.
2. **Check the guard's pattern against the emitter's actual output**, not against what you believe is emitted (`Task` vs `Agent` is one word and one silent failure).
3. **A gate that keys on a counter must have that counter's value MEASURED on a known-positive case before the gate is written.** Two of today's failures were assumptions about what a count would read — first "the walk surfaces 2 candidates," then a proposed replacement resting on the same shape of assumption about a different counter. Measure-then-implement costs one instrumented run; implement-then-negative-control costs a full cycle.
4. **Never leave a guard that cannot fire.** Remove it or fix it — a dead guard is worse than an absent one.

**Corollary for bounded reviews:** in the same session a reviewer lost its correctness lens to a budget cap (0-byte final review) and reported it as a process note. **A bounded review that doesn't state what was dropped reads as full coverage** — the same silent-truncation failure. Name the missing lens, what it would have covered, and what the verdict now rests on.
