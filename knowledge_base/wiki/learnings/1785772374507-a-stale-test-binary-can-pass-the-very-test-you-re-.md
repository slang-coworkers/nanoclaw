---
title: "A stale test binary can pass the very test you're validating — prove the relink before reporting numbers"
type: learning
topic: misc
source: learnings/1785772374507-a-stale-test-binary-can-pass-the-very-test-you-re-.md
---

# A stale test binary can pass the very test you're validating — prove the relink before reporting numbers

## Rule

Before reporting any test result from a compiled suite, **prove the binary you ran was actually rebuilt from the code under test.** The cheap check: the test binary's mtime must be **newer than the build start**. Make it an explicit requirement in build briefs and subagent prompts, not an assumption.

## The why (near-miss, slangpy#1073 profiler barrier redesign, 2026-08-03)

A `sgl_tests` binary sitting in the worktree was **10 days old** (dated 07-24) and **still passed the cross-thread profiler test** — the exact test being used to validate a concurrency fix. Running it would have produced a clean, confident "suite passes" report about code that was never compiled. The build subagent caught the stale mtime and **refused to report numbers without a relink**.

This is nastier than a normal stale-artifact bug because:
- The stale binary **passes**, so nothing looks wrong — there's no error to investigate.
- The result is *plausible* (it's the same test name, same suite, same expected numbers), so it survives review.
- For a **timing/concurrency** fix it's doubly deceptive: these tests are nondeterministic, so "it passed" was never strong evidence to begin with; running a stale binary means you have *zero* signal while believing you have positive signal.

## How to apply

- **Assert the relink:** capture a timestamp before the build, then require `test_binary_mtime > build_start`. Refuse to report pass/fail numbers if it doesn't hold. (A build that silently no-ops — nothing to do, failed early, wrong target, wrong build dir — leaves the old binary in place.)
- **Prefer a positive relink signal** over inferring from build-command exit 0: a build can exit 0 having rebuilt nothing relevant.
- Same discipline applies to any cached/derived artifact you then measure: compiled binaries, generated docs, emitted shader assembly, lockfiles.
- Pair with the existing rule that a **green run of a timing-dependent test does not validate a memory-ordering fix** — if the test is nondeterministic, add a flake probe (e.g. 30×) *and* prove the binary is current. Neither alone is evidence.

## Generalization

The failure class: **an unchanged artifact produces a passing result, and passing is read as verification.** Whenever a check's PASS could be produced by "nothing actually happened," that PASS carries no information. Ask: *if my change hadn't been compiled in at all, would this still have gone green?* If yes, you need a freshness assertion before the result means anything.

Related: [Review gates validate the shape you chose…] and [Name what you held fixed] — same family, i.e. a green signal that is silent about the thing you actually care about.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785772374507-a-stale-test-binary-can-pass-the-very-test-you-re-.md`_
