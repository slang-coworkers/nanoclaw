---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786439928834-tf6a34
written_at: 2026-08-11T12:12:18.036Z
---

# [approver/critique-mustfix] Four successive errors on ONE number, each committed while fixing the previous — a correction inherits no credibility from the error it repairs

**Symptom** (slang-rhi#827, 2026-08-11): I got a single trivial figure — the CI check count on one commit — wrong **four times in a row**, and every error after the first was introduced *by the act of correcting its predecessor*. Each successive version sounded more rigorous than the last.

1. **Sourcing violation.** I wrote "CI 26/26 green", lifted from a post-merge browser capture whose time-varying claims I had *myself* declared discarded two paragraphs earlier in the same document.
2. **Correcting it, I falsified a true number.** I replaced 26 with 27 and asserted the original was numerically wrong. It was not: `repos/{o}/{r}/commits/{sha}/check-runs` returns `total_count = 26` exactly. My 27 came from `gh pr view --json statusCheckRollup`, a *different scope*. Two correct counts over different scopes look like one wrong instrument. (I hold that exact maxim in my own store and tripped it anyway, because I was mid-correction and let the correction over-reach.)
3. **Correcting that, I gave an impossible arithmetic.** I described the relationship as "26 check-runs **plus** 2 statuses" = 27. 26+2≠27.
4. **Correcting that, I over-generalized a mechanism.** I wrote that the rollup "de-duplicates check-runs". Measurement says otherwise: it omitted **one** duplicate skipped `Claude Code Assistant` context while **retaining all three** duplicate-named `board-sync / board-sync` runs. There is no general de-dup rule visible; I still do not know the rule.

Ground truth, measured: 26 raw check-runs = 23 success + 3 skipped, containing duplicate names; 27 rollup contexts = 25 CheckRun + 2 successful StatusContext. No failures under either view.

**Root cause.** A correction arrives wearing the credibility of the error it fixes. Having just caught myself, I felt *more* reliable, not less — so each replacement value got less scrutiny than the claim it displaced, even though a replacement is a **brand-new claim with its own evidence burden**. The escalating confidence is the mechanism: "I already checked this once" is precisely false about the new number.

**How to catch it**
- **A correction is a new claim. Measure the replacement; never derive it from the thing you just disproved.** What finally held was `--jq 'group_by(.conclusion)'` plus an explicit duplicate-name check — a measurement, not a better argument. Every version that came from reasoning about the previous version was wrong.
- **When two sources disagree on a count, the default hypothesis is different scopes, not one being wrong.** Name the endpoint and the filter beside every number: "26 raw check-runs" and "27 rollup contexts" are both right; "the CI count" is not a fact.
- **Arithmetic-check your own explanations.** "26 plus 2 equals 27" survived because it was prose, and prose doesn't get summed. If a sentence contains an implicit equation, evaluate it.
- **Do not upgrade an observation to a mechanism.** One missing entry licenses "this list has one fewer X than that one", never "the API de-duplicates". If you cannot state the rule, say you do not know it.
- Cheapest general guard: after correcting anything, re-read the *corrected* sentence as though someone else wrote it, and ask what measurement backs it. Mine had none, three times running.

**Cost note:** none of this changed the decision — CI had no failures under any reading. The whole chain was spent on a figure that carried no decision weight, which is also why it got sloppy scrutiny. **Low-stakes numbers are where correction discipline decays, and the habit transfers to high-stakes ones.**
