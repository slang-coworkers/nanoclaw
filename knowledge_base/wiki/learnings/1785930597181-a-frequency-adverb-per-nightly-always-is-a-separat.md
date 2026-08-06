---
title: "A frequency adverb ('per nightly', 'always') is a separate empirical claim from the mechanism it modifies — count the population first"
type: learning
topic: review-process
source: learnings/1785930597181-a-frequency-adverb-per-nightly-always-is-a-separat.md
---

# A frequency adverb ("per nightly", "always") is a separate empirical claim from the mechanism it modifies — count the population first

## What happened
While triaging shader-slang/slang#12364 I published, on GitHub, that VK-GL-CTS 0.0.9 "fixes the
`slang.dll`→`slang-compiler.dll` load failure **that has been costing 11,545 tests per nightly**".

The **mechanism was correct and verified**: Slang renamed its library (`dcb47b716`), the CTS 0.0.7 binary
calls `LoadLibraryA("slang.dll")`, and the workflow copies only `slang-compiler.dll` — never the
forwarding shim that `source/slang/CMakeLists.txt:423` builds. I had read every one of those lines.

The **frequency was false**, and I never measured it. `actions/workflows/<id>/runs?event=schedule` ⇒
`total_count` **37**, returned 37 (complete retained population) = **35 success / 2 failure**. Only
08-04 and 08-05 failed. "Per nightly" asserts a standing rate that 35 passing runs falsify.

## The lesson
**A rate/frequency adverb is a separate empirical claim from the mechanism it modifies, and it needs its
own measurement.** I had verified a *causal path* and then attached a *frequency* to it for free. The
mechanism's correctness is exactly what made the frequency feel checked — nothing in the code reading
could have contradicted "per nightly", because the code says nothing about how often the condition fires.

Before publishing `always` / `per-run` / `every` / `has been` / `consistently`, ask: **what is the
denominator, and did I count it?** A latent defect and a standing defect have identical mechanisms and
opposite operational meanings — one is "a thing switched on yesterday", the other "your CI is broken".

## The discriminator that identified it as latent (worth stealing)
Same runner (`SLANGWIN5`), same 0.0.7 artifact, same copy list on the passing and failing nights ⇒ *not*
a runner-identity or workflow difference. The split was the **test-server**:
- 08-03 (pass): `spawinAndWaitTestServer` ×3, **0** load failures.
- 08-04/08-05 (fail): spawn lines ×**0**, 11,545 load failures, and **23,090** logger lines = exactly
  2× 11,545 — two in-process `LoadLibraryA` attempts per test, i.e. the fallback path taken *because*
  no server spawned.
The exact-2× arithmetic is what confirmed the fallback reading rather than merely suggesting it. When two
counts in a log are an exact small-integer multiple, that ratio is usually a structural fact about the
code path, and it is cheap to check. **Onset still unexplained — published as unexplained.**

## Handling it: PATCH, and assert your anchor
This superseded *my own* claim (not an independent addition), nobody had replied, I was sole commenter
⇒ **PATCH in place, not a new comment**. A PATCH notifies nobody and doesn't bury the correction below
text people already scrolled past.
Two guards that earned their keep:
1. **Drift check immediately before editing** — re-read live (`len`, `updated_at == created_at`, last
   commenter) so I wasn't overwriting someone's reply.
2. **`assert old in s` before the replace** — a stale anchor then *aborts loudly* instead of silently
   no-op'ing and reporting success. Verified after: false phrase 0 occurrences, 5 correction fragments
   present, 4 originals preserved, `comments` still **1** (edited, not stacked), zero HTML-escaping.

## Instrument note (nearly a silent zero)
`GET actions/workflows/<id>/runs` returns the key **`workflow_runs`**, NOT `runs`. My first parse raised
`KeyError` — an *instrument* error, loudly. Had I written `d.get('runs', [])` it would have returned an
empty list and I'd have "confirmed" zero runs, i.e. manufactured agreement with whatever I expected.
**Prefer the form that throws over the form that defaults** when the value is load-bearing.

## Companion to an existing rule
This is the frequency-flavoured twin of *"a wrong mechanism attached to a right conclusion draws no
pushback"*: here a **right mechanism** lent unearned credibility to a **wrong frequency**. Audit the
quantifier separately from the causal story, because no amount of source reading will falsify it.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1785930597181-a-frequency-adverb-per-nightly-always-is-a-separat.md`_
