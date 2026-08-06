---
title: "SLANGWIN5 spirv-val recovered — and the ratio that describes it is a window artifact"
type: learning
topic: slang-compiler
source: learnings/1785968653394-slangwin5-spirv-val-recovered-and-the-ratio-that-d.md
---

# SLANGWIN5 spirv-val recovered — and the ratio that describes it is a window artifact

## SLANGWIN5 `spirv-val [ 0 / 866 ]` is RESOLVED as of 2026-08-05 ~21:45Z — #12341 closed

The `test-compile-regression / Test (Compile Regression)` failure on runner **SLANGWIN5**, where all
866 shaders compile (`PASSING [ 866 / 866 ]`) but the validator scores `PASSING spirv-val [ 0 / 866 ]`,
has **recovered**. Verified from job logs, not from run-level `.conclusion`:

- run `31047790392` job `92454170923` — 21:45:23Z — `PASSING spirv-val [ 866 / 866 ]`
- run `31048171028` job `92455852545` — 21:57:30Z — `PASSING spirv-val [ 866 / 866 ]`

First non-zero validator scores on that host since the ~08-04 00:48Z onset (prior streak: 12 fail /
0 pass). **#12341 closed; #12342 — `GlslangDownstreamCompiler::validate` conflating "validator
unavailable" with "invalid SPIR-V", which is what made the score unreadable — is still OPEN.**

**Grep key is `spirv-val` ALONE.** The emitted bytes have inner spaces, so the compact form a fluent
reader types (`spirv-val \[0/866\]`) returns a confident **zero**. Copy markers from the log.

## The reusable trap: a whole-day ratio on a host that changed state mid-day

08-05 compile-regression on SLANGWIN5 = **13 failure / 3 success / 1 cancelled(UNTESTED)** — and
**all 3 successes are ≥21:28Z.** So:

- the **day-wide** ratio (~19% pass) says "still badly broken" → under-reports the recovery
- a **last-15-runs** ratio (~50%) says "flaky" → over-reports it
- the **newest rows** are the actual signal: two clean passes back to back

Both ratios are arithmetically correct and both mislead, in *opposite* directions. When a host or
job class changes state partway through your window, **no single ratio over that window is a
statement about current health** — it is a statement about the window. Print the bounds, and let the
newest terminal rows carry the verdict.

Also: bucket `cancelled` as **UNTESTED**, never as pass or fail — it silently inflates whichever
side you fold it into.

## Operational consequence for CI babysitting

A compile-regression red on SLANGWIN5 is once again a **fair re-draw**, so a rerun is now justified
where it was previously near-futile (the "reruns clear it by lottery" claim was refuted in-dataset:
one run drew SLANGWIN5 on att1/att2/att3, ~1h46m burned, before att4 escaped). Cap at 2 same-run
reruns and prefer a fresh dispatch.

⚠️ **A future `[ 0 / 866 ]` on this host is a REGRESSION of a closed issue — re-open it, do not
silently rerun.** Silently rerunning is how a resolved-then-regressed infra defect becomes
invisible again.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785968653394-slangwin5-spirv-val-recovered-and-the-ratio-that-d.md`_
