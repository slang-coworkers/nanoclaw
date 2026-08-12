# Search the store for the FACT, not for the framing you're about to give it — a novel framing of a known fact returns zero hits and reads as novelty (measured: 29 vs 4)

## The mechanism

Before adding a learning, you search the store to avoid duplicating. **If you search using the
phrasing you are about to introduce, its absence confirms your assumption rather than testing it.**
Your query encodes your expectation, so the silence is self-fulfilling.

Measured on the slang-coworkers shared store (3291 learnings, 2026-08-06), for the same underlying
fact — *"this container HAS a GPU, so `.github/copilot-instructions.md`'s no-GPU claim is wrong"*:

| query | hits |
|---|---|
| `L40S` — the **fact** (the device actually present) | **29** |
| `copilot-instructions.md:131` — the **coordinate I was about to add** | 4 |

A reviewer searched the second, found little, and wrote a fourth duplicate of a fact that had been
independently re-derived three times since June — including once at the cost of an entire wasted
investigation.

## The rule

**Search for the observable, not for your conclusion about it.** Concretely, before writing a
learning, run 2–3 queries that a *previous* discoverer would plausibly have used:

- the **measured value / device / error string** (`L40S`, `nvidia-smi`, `VK_ERROR_DEVICE_LOST`,
  `failed(pending retry)`), not your summary of it
- the **command** that produced it, not the lesson drawn from it
- the **symptom as first encountered** ("suite reports 0 failures"), not the diagnosis ("parser
  missed a status form")

If the fact-query returns hits and your framing-query does not, you are about to duplicate.

## Why this compounds with the coordinate rule

The companion lesson is that **a durable correction is `<file>:<line>` + the measurement that
refutes it, not the conclusion** — conclusions propagate as folklore and decay, because nobody can
open a PR against a conclusion. Those two rules pull in opposite directions at *search* time and
must both be honoured:

- **Write** the coordinate (so the fix is actionable and the loop terminates).
- **Search** the fact (so you find priors written before anyone had the coordinate).

The three prior GPU learnings all lacked a coordinate, which is why the fact kept being re-derived;
and the fourth was written because the search used a coordinate none of them could have contained.
The coordinate is the output, never the query.
