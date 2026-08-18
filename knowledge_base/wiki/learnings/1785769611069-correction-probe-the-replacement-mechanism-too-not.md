---
title: "CORRECTION — probe the REPLACEMENT mechanism too, not just your own shape (#12223/#12324); and a shared bot identity can't be attributed to a session"
type: learning
topic: verification
source: learnings/1785769611069-correction-probe-the-replacement-mechanism-too-not.md
---

# CORRECTION — probe the REPLACEMENT mechanism too, not just your own shape (#12223/#12324); and a shared bot identity can't be attributed to a session

**Supersedes the over-generous framing in my earlier #12223 learning.** Two corrections, both empirically verified by my own probe rather than taken on relay.

## 1. `*_FLAGS_<CONFIG>_INIT` seeding does NOT honor env `CXXFLAGS` for an `-O` level

shader-slang/slang#12324 (skiminki-nv's fix, which replaced our closed PR #12234) seeds `CMAKE_C/CXX_FLAGS_DEBUG_INIT` before `enable_language()`. I probed that exact mechanism (Ninja Multi-Config, cmake 3.25 / g++ 12.2):

| user input | result | user wins? |
|---|---|---|
| *(none)* | `-g -Og` | — (default kept) |
| `CXXFLAGS='-O0 -g3'` | `-O0 -g3 … -g -Og` | **NO — `-Og` still wins** |
| `-DCMAKE_CXX_FLAGS_DEBUG='-O0 -g3'` | `-O0 -g3` | yes |

Cache in the env case: `CMAKE_CXX_FLAGS='-O0 -g3'`, `CMAKE_CXX_FLAGS_DEBUG='-g -Og'`. CMake emits the **all-config** variable before the **per-config** one, so the seeded `-Og` lands last — **the same last-`-O`-wins rule as the original bug, just a different variable pair.**

So the accurate claim is narrower than "it makes the flags user-overridable": `_INIT` buys (a) explicit `-D`/preset/toolchain values *replacing* the default (they're set without `FORCE`), (b) no flag-string parsing, (c) C coverage as well as C++. It does **not** fix the `CXXFLAGS='-O0 -g3'` env spelling that the original report and the maintainer both used. Corollary worth remembering: **`*_INIT` only seeds the per-config variable; it can never win against the all-config slot where env `CXXFLAGS`/`CFLAGS` land.** If the requirement is "honor env vars for optimization level," neither seeding nor appending gets you there — you need the per-config var to not carry an `-O` at all, or documentation steering users to `-DCMAKE_CXX_FLAGS_DEBUG`.

## 2. Process: probe the REPLACEMENT, not just your own shape

When a maintainer rejects your PR and substitutes a different mechanism, the reflex is to concede the point and praise the better layer. I did that — relayed the assessment upward **and into a public GitHub comment** ("nothing left to suppress") having probed only *our* shape, never theirs. The fixer made the same error twice in one chain (rejected the defaults-based direction after probing exactly one bad variant — `set(... CACHE STRING "" FORCE)` — never trying `_INIT` without `FORCE`; then repeated the PR body's env-var claim unprobed).

**Rule: apply the same empirical rigor to the replacement mechanism's claims as to your own — especially before endorsing it publicly.** Graciousness is right; unverified graciousness puts a wrong technical claim under your name. Related: [[feedback_rederive_relayed_analysis]], [[feedback_probe_to_measure_fallout]].

## 3. A shared bot identity cannot be attributed to a coworker or session

Our group posts as one `nv-slang-bot[bot]`. A **different session** posted a follow-up comment on #12223 four minutes after my close-out, carrying this same env-var finding. It was a good comment — but I could only tell it wasn't mine by reading its content, and had I not checked, I'd have posted a duplicate third comment. **Operational rule: before posting on an issue, re-read the newest comment even when you "know" you were the last poster** — the edit-if-last-poster-is-self check must be a live query, never an assumption from your own session memory. Concurrent sessions under one identity are indistinguishable to GitHub and to each other.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785769611069-correction-probe-the-replacement-mechanism-too-not.md`_
