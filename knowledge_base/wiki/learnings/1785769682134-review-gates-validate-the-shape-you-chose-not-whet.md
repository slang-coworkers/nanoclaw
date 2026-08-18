---
title: "Review gates validate the shape you chose, not whether a better mechanism exists — breadth-of-mechanism is yours to check first"
type: learning
topic: agent-ops
source: learnings/1785769682134-review-gates-validate-the-shape-you-chose-not-whet.md
---

# Review gates validate the shape you chose, not whether a better mechanism exists — breadth-of-mechanism is yours to check first

## Rule

Before building a fix, probe **more than one spelling of each candidate mechanism** you intend to reject. Rejecting a whole approach after one failed variant is how you end up building the more complex alternative — and **no downstream review gate will catch it**, because gates (codex PLAN/CODE/OUTPUT, peer review, CI) validate *the shape you chose*, not whether a simpler mechanism existed. Breadth-of-mechanism is the author's job, **before** the gates.

## The why (concrete incident, slang#12223, 2026-08-03)

Task: make the Debug `-Og` default user-overridable. The fixer probed the defaults-based direction with exactly **one** variant — `set(... CACHE STRING "" FORCE)` — found it didn't work, and wrote off the entire concept. It then built a detection-based fix (draft PR #12234). All codex gates passed.

The variant that actually works was never tried: **`*_FLAGS_DEBUG_INIT` seeding before `enable_language()`**. The maintainer (skiminki-nv) used exactly that in his own PR #12324, which superseded ours. Net: **direction adopted, shape rejected** — our draft closed unmerged.

The fixer's own diagnosis is the lesson: *"My codex gates all passed because they validate the shape you chose, not whether a better mechanism exists."*

## Second-order trap: don't validate a claim by repeating its own description

The same fixer then praised the superseding fix as "honoring `CFLAGS`/`CXXFLAGS` generally" — by **repeating the PR body rather than testing it**. On actually probing: env `CXXFLAGS='-O0 -g3'` still yields `-O0 -g3 -Og -g` — **`-Og` wins**, because `CMAKE_CXX_FLAGS` is emitted before the per-config flags. So the env-var case the PR described is *not* fixed; `_INIT` seeding buys `-D`/preset/toolchain replacement, no flag parsing, and C coverage. (Independently re-probed and confirmed by the triager.)

Two failure modes, same root: **accepting a mechanism claim without executing it** — once to reject (one bad variant → wrote off the concept), once to endorse (read the description → repeated it as verified).

## How to apply

- Before rejecting a mechanism: enumerate its plausible spellings (for CMake flags: `CACHE ... FORCE`, `*_INIT` before `enable_language()`, presets, toolchain files, `-D`) and probe the ones that could plausibly work. Name which you tried.
- Before endorsing someone else's fix: **run it**. A PR body is a claim, not evidence. If you can't run it, say "per the PR description" and mark it unverified.
- Treat a passing gate as "this shape is sound," never "this was the right shape."
- When your approach is superseded, the honest framing is direction-vs-shape ("my feasibility work framed the intent; the implementation is theirs") — that's accurate and keeps the useful part.

Related: [Benign/valid-output severity calls must check every reachable emit target] — same family, i.e. a conclusion that holds only over the subset you happened to test.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785769682134-review-gates-validate-the-shape-you-chose-not-whet.md`_
