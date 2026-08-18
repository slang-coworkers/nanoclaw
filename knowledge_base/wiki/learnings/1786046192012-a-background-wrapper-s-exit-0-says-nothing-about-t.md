---
title: "A background wrapper's exit 0 says nothing about the work it wrapped"
type: learning
topic: misc
source: learnings/1786046192012-a-background-wrapper-s-exit-0-says-nothing-about-t.md
---

# A background wrapper's exit 0 says nothing about the work it wrapped

## The trap

Launching a long job with `nohup <cmd> … &` (or any `&`-detached wrapper) inside a background Bash
tool call makes the **launcher** the thing whose exit code is reported. The harness then notifies
*"completed (exit code 0)"* within seconds, while the real work is still running.

Observed 2026-08-06: I started two `slang-test` suites this way and got two
`completed (exit code 0)` notifications almost immediately. Reality at that moment:

- `pgrep -c -f 'slang-test'` → **12** processes still running
- both log files still sat at their `Supported backends: …` preamble
- **zero** test results in either log

Had I reported from those logs, I'd have published a passing validation matrix derived from two
files containing no results — and the output would have looked exactly like a real pass, because
"tail of a log with no failures in it" is formatted identically whether the suite passed or never
ran.

## Why it's dangerous specifically

This is the wrapper-level twin of the better-known slang trap that `slang-test <bad name>` prints
`no tests run` and exits **0**. Both collapse to: *a zero exit means nothing errored, not that
something ran.* The wrapper version is worse in one way — the notification actively asserts
"completed", so it reads as positive evidence rather than absence of evidence.

## The fix

Gate on a **positive artifact the work itself must emit**, never on the wrapper's exit:

- For `slang-test`, require the summary line: `N% of tests passed (N/N)`, and treat a missing
  summary as its own distinct verdict (`ENDED WITHOUT SUMMARY`), not as "still running".
- Cross-check with `pgrep -f <the real binary>` before believing any completion signal.
- When arming a `Monitor`, include an arm that fires when the process disappears *without* having
  produced the summary — otherwise a crash is indistinguishable from silence.

```bash
# Wrong: notification fires in seconds, means nothing
nohup timeout 1800 ./build/Debug/bin/slang-test tests/foo/ > log 2>&1 &

# Right: wait on the artifact the suite must print
grep -oE '[0-9]+% of tests passed \([0-9]+/[0-9]+\)' log | tail -1
```

## Bonus, same session: prefer the delta over the ratio for slang-test counts

A slang-test denominator is a function of {suite, commit, API detection, flags} — it moves with the
machine's detected backends, not just the file set (same commit/suite gave 56/56 with detection on
vs 49/49 under `-api '-all'`). So when validating that *new tests actually ran*, report
`32/32 → 34/34 (+2 = the files I added)`. A bare `34/34` invites a cross-machine comparison the
number cannot bear, and a suite that silently never collected your new file looks green.
Corollary: capture the pre-change baseline **before** building the fix — afterwards you cannot
measure it without reverting.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786046192012-a-background-wrapper-s-exit-0-says-nothing-about-t.md`_
