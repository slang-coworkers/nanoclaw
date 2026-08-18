---
title: "A finding that contradicts the PR's own working numbers is a claim about your environment"
type: learning
topic: verification
source: learnings/1785917892754-a-finding-that-contradicts-the-pr-s-own-working-nu.md
---

# A finding that contradicts the PR's own working numbers is a claim about your environment

## The rule

When you review an instrument (script, telemetry, probe) by **running** it, and your run
contradicts a number the PR author reports as working, the default hypothesis is **your
environment is broken, not their code**. Build an **auth-free / dependency-free probe** that
isolates the mechanism before publishing anything.

## What happened (nanoclaw#1078, 2026-08-05)

Reviewing `scripts/regression-quality.py`, I probed `gh api --paginate` output shape and saw a
`}{` boundary mid-stream. I read it as a **page seam**, concluded the script's fallback parser
(`json.loads("[" + stdout.replace("][", ",") + "]")`) was load-bearing and broken, and was about
to file it as a 🔴.

Two things were wrong:

1. **The `}{` was the OneCLI 401 error body**, not a page seam. Every `--paginate` call in my
   container fails with `app_not_connected`. I was characterizing my own auth failure and
   calling it pagination. Caught only by printing the bytes *after* the boundary.
2. **`gh --paginate` emits ONE merged array**, not concatenated arrays. Settled by standing up a
   local 3-page TLS API — auth-free, so the 401 could not confound it. gh 2.96 output:
   `[{n:1},{n:2},{n:3},{n:4},{n:5}]`, which `json.loads` parses directly. (`--slurp` is what
   produces an array-of-pages.)

So the truthful finding inverted: the fallback is **dead code**, not broken code. Both are
findings, but only one is true — and the false one would have sent the author to fix a line that
never executes.

## The signal I should have acted on sooner

The PR body reported a populated result table. My run produced the same numerator but empty rate
columns. **That contradiction was the tell** — it meant one of us was measuring a different
system. Instead of treating it as evidence about the script, treat it as a fork: either their
number is stale, or my instrument is broken. Distinguish before writing.

## How to apply

- Before publishing an instrument finding, ask: **does this contradict something the author
  reports as working?** If yes, construct a probe with no shared dependency on the suspect layer
  (local server, fixture, stub) and re-derive.
- When probing a command's output *shape*, verify the command **succeeded** first (`rc`, stderr).
  A failing command's stdout describes the failure, not the feature.
- `gh api --paginate` merges array pages into one valid JSON array. Any hand-rolled
  `][`-splicing fallback around it is dead code. Related: `--slurp` is mutually exclusive with
  `--jq` (see the `gh api --slurp` learning) — that pairing is the *live* gh trap.
- The genuine defect class in this PR was still real and worth filing: three separate places
  where a transport failure was byte-identical to a legitimate zero, at exit 0. Instrument
  review is about **what the code cannot say** ("I couldn't measure"), and that is only visible
  from running it with a failure injected — never from reading it.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785917892754-a-finding-that-contradicts-the-pr-s-own-working-nu.md`_
