---
title: "grep -c counts LINES not occurrences — and every genuinely new finding in a saturated review came from repairing an instrument, not looking harder"
type: learning
topic: review-process
source: learnings/1785942371271-grep-c-counts-lines-not-occurrences-and-every-genu.md
---

# grep -c counts LINES not occurrences — and every genuinely new finding in a saturated review came from repairing an instrument, not looking harder

Two closing findings from shader-slang/slang#12353 — one a concrete tool trap, one the pattern the whole multi-round review demonstrated.

## 1. `grep -c` counts matching lines, not occurrences

Verifying that a doubled quotation had been removed from a PR body, I ran:

```bash
gh pr view N --json body -q .body | grep -c "Diagnostics sharing a numeric code…"   # -> 1
```

and read `1` as the *old* count, reporting "still doubled." Wrong twice over:

- **`grep -c` reports the number of matching LINES**, not matches. The two copies had been on separate lines, so it would have printed `2` before and `1` after — i.e. it *had* changed and I misread it.
- More importantly the predicate **cannot** distinguish one occurrence from two on the same line. Had the duplication been intra-line, `-c` would print `1` in both the broken and fixed states. **A count whose unit isn't the thing you're counting.**

Correct form: `grep -o PATTERN file | wc -l`. And for a "did this class of defect get swept" check, enumerate rather than tally — e.g. collect all quoted fragments over N chars and report any with count > 1, so you see *which*, not *how many*.

Generic rule: **before believing a count, name its unit.** `-c` is lines; `wc -l` is newlines; `wc -w` is whitespace-delimited tokens; `grep -o | wc -l` is occurrences. This is the same family as an aggregate that can't represent the specific — the number is well-formed and answers a different question than the one asked.

## 2. In a saturated review, new findings come from repairing instruments, not adding attention

Across three review rounds with four agents, **every genuinely new finding came from fixing something that was measuring, not from looking harder:**

- Repairing a web-scraper's done-check (it had been satisfied by an unrelated counter on the page) → on its very next run it surfaced a real test-abort-under-alternate-build-config gap that four reviewers had missed.
- Adding a transcript-recovery path (read `Write` tool-call payloads out of a dead run's stream) → recovered two complete review passes that a guard had declared lost, twice, including a finding nobody else had.
- Making a citation-checking predicate **ref-aware** (record which tree it validated against) → flagged a genuinely wrong line number on its first run, after four readers had spent several exchanges arguing about that exact citation and missed it.

Meanwhile the additional human-directed attention produced corrections to each other's *measurements*, not new findings about the code. The root-cause analysis of the actual bug was correct from the first commit and never changed.

**Practical implication:** when a review has already had several passes and is still turning up nothing new, the marginal return is in auditing the instruments — the scrapers, extractors, guards, greps, and drift checks — not in another reviewer. Attention saturates; instruments stay broken silently.

**Corollary on provenance, which is why one of those errors survived:** the wrong line number had been **copied from a build log**, and a build log is branch-relative *by construction*. Numbers lifted from build output, test output, or stack traces are relative to whatever tree produced them and need conversion before entering base-relative prose. Nobody catches it because nobody asks where a number came from — it looks like every other plausible citation.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785942371271-grep-c-counts-lines-not-occurrences-and-every-genu.md`_
