---
title: "A passing sibling job can refute the 'consistent multi-platform = legitimate' heuristic"
type: learning
topic: misc
source: learnings/1785954484552-a-passing-sibling-job-can-refute-the-consistent-mu.md
---

# A passing sibling job can refute the "consistent multi-platform = legitimate" heuristic

## Same test failing on 2+ platforms is NOT automatically a real regression — check whether a *passing* leg hit the same signature and recovered

Observed 2026-08-05 on shader-slang/slang PR #12354, run 31024965474.

The babysitter rule "consistent test failures across multiple runners/platforms ⇒ legitimate, do NOT rerun" is a good default, and this case matched it on its face:

- `SlangcSeparateDebugInfoOutput` / `SlangcCoverageManifestOutput` / `SlangcReadFromStdin`
- **the same 3 tests**, FAILED on **both** `test-linux-debug-gcc-x86_64` and `test-windows-release-cl-x86_64-gpu`
- different OS, different runners, same head sha

By the heuristic alone: legitimate, decline the rerun.

**What refuted it:** I pulled the *passing* sibling leg on the same run and same sha — `test-linux-release-gcc-x86_64`, job 92380999551, conclusion **success**. That green leg hit the **identical** signature:

```
[slang-unit-test-tool/SlangcSeparateDebugInfoOutput.internal] JSON RPC failure: waitForResult()
[slang-unit-test-tool/SlangcSeparateDebugInfoOutput.internal] rpc failed
failed(pending retry) 'slang-unit-test-tool/SlangcSeparateDebugInfoOutput.internal'
passed test: 'slang-unit-test-tool/SlangcSeparateDebugInfoOutput.internal'
```

It failed the same way and **recovered on slang-test's built-in retry**. So the failure mode is *recoverable at this sha* — a test-server transport flake whose retry happened to succeed on one leg and exhaust on two others. Not a code defect. 14 rpc events on the failing legs vs 2 on the passing one.

**The generalizable probe:** before accepting "multi-platform ⇒ legitimate", ask *did any leg on this same sha hit this same signature and pass?* If yes, the multi-platform spread is measuring flake **frequency**, not determinism. Only the green legs can tell you this — a survey restricted to the failing jobs cannot, and that restriction is invisible in the result.

Cheap version: for a job matrix, always fetch one **successful** sibling and grep it for the failing signature. Absence there strengthens "legitimate"; presence-plus-recovery refutes it.

**Also caught, same log — a grep that returned a false zero.** The emitted form is uppercase:

```
FAILED test: 'slang-unit-test-tool/SlangcReadFromStdin.internal'
```

My `grep -oE "failed test: '[^']+'"` returned **zero matches** while the tally line in the same log said `99% of tests passed (11455/11458)` — 3 failures. Zero named failures against a nonzero failure count is the contradiction that exposed it. Always cross-check a "no failures found" grep against the run's own tally, and default to `grep -i` on CI logs.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785954484552-a-passing-sibling-job-can-refute-the-consistent-mu.md`_
