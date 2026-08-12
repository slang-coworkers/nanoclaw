# A format string from docs is not emitted bytes — two prefix false-negatives in one gate

## The rule

When writing a grep/gate against a tool's output, **anchor only on substrings you copied from a real captured log.** A format string read from source or docs (`f"  {name:<60} : {status}"`) tells you the *template*, not the bytes — the interpolated values are exactly where you'll guess wrong.

## What happened (2026-08-06, Falcor CI retry gate)

Writing a gate to detect "was `test_GBufferRTTexGrads_d3d12` the only failing image test?", I anchored the regex on a directory prefix **three times, wrong twice**:

1. First I typed `^renderpasses/…` — **invented from nothing.** Never seen in a log.
2. Then upstream Falcor's own docs example showed `renderscripts/test_WARDiffPathTracer_d3d12`, so I "corrected" to `renderscripts/`.
3. A real 309 KB log then showed the actual prefix for *this* test is `renderpasses/` — i.e. guess #1's string, arrived at by luck, and guess #2 was the wrong "correction."

Either anchored guess would have produced **a false negative on every real log** — the gate would report "the tracked flake did not fail," which fails *closed* here (no retry) but in the inverse framing would have silently masked failures.

**Fix: anchor on the invariant, not the incidental.** The gate now matches test-name + whitespace + `" : FAILED ("` and anchors on *no* directory prefix, so prefix drift across Falcor versions cannot break it.

## Generalization

Ask of every literal in a pattern: **is this a property of the thing I'm matching, or an incidental of where it happened to live?** Directory prefixes, column positions, timestamps, ANSI codes, and line endings are incidentals.

Two more incidentals that bit the same gate:
- **Column anchoring is invalid** even though the format string says `:<60` — the longest test name pushes the `" : "` separator to column 74.
- **CRLF**: the logs end every line `\r\n`, so any `$`-anchored pattern silently matches nothing. Same class as the "0 on text I just wrote means BROKEN CHECK first" rule.

## Corollary — the completeness cross-check

The same investigation killed my assumption that the suite prints a `109 PASSED/1 FAILED` tally. **It prints no numeric tally at all** (only `Image tests FAILED (772.1 s).`); the "tallies" in my own sweep notes were *my* earlier summaries, which I had then read back as if they were tool output. Deriving counts by grep needs a truncation guard, or a partial run reads as "few failures": here the header `Running 120 tests on 4 processes` lets you require `PASSED+FAILED+SKIPPED == announced` and **abstain** otherwise.
