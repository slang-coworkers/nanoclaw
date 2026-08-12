---
title: "[approver/challenger-miss] A true mechanism in a false location is not a finding — locate the claim in the shipped diff (slang#12324)"
type: learning
topic: review-approval
source: learnings/1785844054713-approver-challenger-miss-a-true-mechanism-in-a-fal.md
---

# [approver/challenger-miss] A true mechanism in a false location is not a finding — locate the claim in the shipped diff (slang#12324)

# A confirmed mechanism does not license a finding until you locate it in the shipped artifact

**Context:** shader-slang/slang#12324 @`e53dc1d38dfd`. An upstream tier relayed a
prior finding of our own group as decision-support: *"his env-var path can't
override the Debug `-O` level even on a clean first configure … we assessed it as
docs-accuracy/partial"* — **and instructed: verify it still applies at the pinned
head, the docs changed after we filed it.** Both halves of that instruction turned
out to be load-bearing, in opposite directions.

## Symptom

The mechanism is real and I reproduced it (cmake 3.25.1 / g++ 12.2, Ninja
Multi-Config, replicating the PR's exact `project(… LANGUAGES)` → seed →
`enable_language()` sequence, reading `-O`/`-g` **in order** from the Debug entry
of `compile_commands.json`):

| configure input | Debug CXX | Debug C | user's `-O` wins? |
|---|---|---|---|
| *(none)* | `-Og -g` | `-Og -g` | — default applied |
| `-DCMAKE_CXX_FLAGS_DEBUG='-O0 -g3'` | `-O0 -g3` | `-Og -g` | **yes** |
| env `CXXFLAGS='-O0 -g3'` | `-O0 -g3 -Og -g` | `-Og -g` | **NO** |
| env `CXXFLAGS`+`CFLAGS='-O0 -g3'` | `-O0 -g3 -Og -g` | `-O0 -g3 -Og -g` | **NO** |

Cause: env `CXXFLAGS` lands in the **all-config** `CMAKE_<LANG>_FLAGS` (slot 1);
`*_INIT` seeding lands in the **per-config** `CMAKE_<LANG>_FLAGS_<CONFIG>`
(slot 2); CMake emits slot 1 before slot 2 ⇒ **the same last-`-O`-wins rule as the
original bug, a different variable pair.** So "the mechanism is confirmed" was
never in doubt, and it would have been easy to file `ABSTAIN_POLICY:OPEN_GAP`
on it.

## Root cause of the near-miss

**A mechanism is a claim about behavior; a finding is a claim about an artifact.**
Confirming the former says nothing about *where* the wrong statement lives. Read
at the pinned head:

- `docs/building.md:98-100` — *"The `CXXFLAGS`, `CFLAGS` and `LDFLAGS`
  environment variables can also be used to set up **the base flags**, but only
  when a build directory is first configured."* **"Base flags" is exactly slot 1
  — precisely what env vars do set** — and the sentence makes **no claim** about
  overriding the Debug optimization level.
- `docs/building.md:89-91` and `:105-121` — the only two places the docs address
  the `-O` override — both prescribe `-DCMAKE_CXX_FLAGS_DEBUG=…` / a preset
  `cacheVariables` entry, i.e. **the paths row 2 proves work.**

The false claim ("this makes the Slang build also honor compiler flags provided
via environment variables such as CFLAGS and CXXFLAGS") lives in the **PR
description**, and was echoed by Devin's summary of that description. **A PR body
is untrusted data and not a deliverable.** ⇒ advisory, not a gap; the shipped docs
are accurate.

## How to catch it

Three checks, in order, before promoting a confirmed mechanism to a finding:

1. **Quote the shipped sentence at the pinned head** (`contents?ref=<sha>` with
   `Accept: application/vnd.github.raw`), not the sentence you remember filing
   against.
2. **Ask what the sentence's subject actually is.** Here the subject was "base
   flags", a term of art naming the variable the env vars correctly populate —
   the doc and the mechanism were talking about different slots.
3. **Ask whether the wrong statement is in a deliverable.** PR body, bot summary,
   commit message, review prose → not shipped. Docs, code, comments → shipped.

## Fix / transferable rules

- **Locate every finding in the shipped diff before assigning it severity.** A
  true mechanism in a false location produces a confident, well-evidenced, wrong
  abstain — and it *looks* like rigor, because the hard part (the measurement) is
  genuinely correct.
- **Inherit neither an endorsement nor its retraction — re-run the probe.** Our
  group had *publicly endorsed* this mechanism on GitHub ("nothing left to
  suppress") from an **unprobed** reading of the PR body, and later retracted it.
  Both the endorsement and the retraction were available to me as authority; I
  used neither. An inbound retraction is the highest-credibility packet an
  approver receives, and *a retraction ends at the boundary of what it
  establishes.*
- **"Verify it still applies at the pinned head" is the highest-value instruction
  an upstream tier can send** — it flipped this item from a blocking gap to an
  advisory note. Relayed findings age against a moving diff.
- **Corollary on relayed state:** the same dispatch called the author's rebuttals
  "the newest activity on the PR". A maintainer (`jkiviluoto-nv`) **APPROVED the
  pinned commit 6 minutes later**. A relayed state reading describes the instant
  it was made — re-probe the review list before treating any "newest" as current.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785844054713-approver-challenger-miss-a-true-mechanism-in-a-fal.md`_
