---
title: "Quote a mechanism's source instead of paraphrasing it — one paragraph was wrong three distinct ways (stale totals, false universal, dropped disjunct)"
type: learning
topic: misc
source: learnings/1786080934191-quote-a-mechanism-s-source-instead-of-paraphrasing.md
---

# Quote a mechanism's source instead of paraphrasing it — one paragraph was wrong three distinct ways (stale totals, false universal, dropped disjunct)

One paragraph of a PR description — explaining why CI showed no test results — was wrong three times in a row, each in a *different* way, and each fix created the opening for the next:

1. **Stale mutable totals.** "81 check-runs, 74 skipped…" measured at a head that a later force-push superseded. Fixed by re-censusing.
2. **Self-falsified claim.** Rewrote it as "no workflow ran / no red mark" — then dispatched CI myself, creating the very run the text denied. Fixed by replacing the mutable quantity with the *invariant* it was evidence for: "the number of non-skipped `test-*` check-runs is 0", which holds regardless of dispatch state.
3. **False universal, introduced by that generalisation.** The invariant was fine; the sentence I wrapped around it said "each `ci.yml` dispatch on a draft yields to the priority gate." Reading `extras/ci/wait-for-priority.py`: it yields only when a contender exists, and an anti-starvation rule (`--max-yield-hours 12`) makes a long-waiting run proceed regardless. Not automatic in either direction.
4. **Dropped disjunct while paraphrasing.** Rewrote it to describe the observed run and cite the script — and wrote "an older bot run is still **queued**" where the source says "queued **or in progress**", also losing "for the same workflow" from the human clause.

**Lessons, in the order they generalise:**

- ⭐⭐ **Generalising to escape staleness is not free — the generalisation is a new claim needing its own check.** Replacing a measured total with an invariant is the right move (step 2→3), but a universal cannot be confirmed by the single observation that prompted it. I traded a stale fact for an unverified one.
- ⭐⭐ **Prose describing someone else's control flow should quote the source, not paraphrase it.** Every paraphrase is a fresh chance to drop a disjunct, and the result reads *fluently* — the sentence still parses and still sounds like a mechanism, so nothing prompts a re-check. A quoted docstring line with a `file:line` cannot lose "or in progress".
- ⭐ **State the invariant, not the reading.** "Non-skipped `test-*` = 0" survived all four rounds unchanged and was the only merge-relevant claim in the paragraph. Everything that needed correcting was scaffolding around it: counts that mutate, mechanisms I restated, colours that change per dispatch.
- ⚠️ A paragraph that has been wrong twice is likely to be wrong a third time in a *new* way. Rewrites don't converge on correctness by themselves; each one is a fresh draft with fresh defects. Count the rewrites, and when it hits three, stop rewriting and start quoting.

Meta: all four were caught by an adversarial reviewer reading the actual workflow scripts, not by me re-reading my own prose — consistent with prose edits having no instrument ([[technique_prose_edits_have_no_instrument]]): rereading is what produced the text, so it cannot audit it.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786080934191-quote-a-mechanism-s-source-instead-of-paraphrasing.md`_
