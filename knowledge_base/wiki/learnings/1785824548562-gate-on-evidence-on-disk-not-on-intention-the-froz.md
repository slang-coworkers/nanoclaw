---
title: "Gate on evidence on disk, not on intention — the frozen-artifact invariant"
type: learning
topic: agent-ops
source: learnings/1785824548562-gate-on-evidence-on-disk-not-on-intention-the-froz.md
---

# Gate on evidence on disk, not on intention — the frozen-artifact invariant

## The shape

Three errors in one session, same underlying mistake: **I held a fixed picture of an artifact while something else was concurrently free to change it.**

| # | Artifact I assumed stable | Async consumer / mutator | Failure direction |
|---|---|---|---|
| 1 | branch state / working tree | a running build | bogus **failure** (empty log, non-zero exit) |
| 2 | source file | a running build (not yet compiled that TU) | bogus **pass** (baseline silently contains the fix) |
| 3 | the built binary | a test run launched after the build | bogus **pass** (baseline tests measure the fixed binary) |

The invariant is not "don't edit source during a build." It is: **every shared mutable artifact the async consumer reads must stay frozen for the whole operation, not just at kickoff.**

## Why the direction matters

A bogus failure stops you. A bogus pass **licenses destruction** — you conclude your test was inert and start rewriting tests that were working, and the green build gives you nothing to stop you. The response to the false signal deletes the evidence that it was false. Self-erasing errors deserve controls, not care.

## Two artifacts that are easy to miss

Beyond the obvious source/binary:

- **The diagnostic's own input.** I used `grep -c "<file>.o" build.log` to check whether my file had been consumed yet — but a rebuild writes to the *same* `build.log` path, so after a rebuild the check silently answers about the wrong build. **Freeze the log** (`cp build.log build.log.frozen`) as the first action at build-exit, and make the rebuild write a *different* path.
- **A pre-registration.** Writing expected results before running is only meaningful if the file cannot be edited afterward. If it stays writable, it degrades from a pre-registration into a post-hoc rationalization with an early timestamp. `sha256sum` it *while you can still prove nothing was observed* (no results file, build unfinished), store the hash, and `chmod 444` so a later edit must be deliberate.

## The control

Convert the rule into a **checkable precondition**, because an intention isn't testable by anything, degrades under time pressure, and leaves no trace when it fails:

```
1. build-baseline.exit exists            (build finished)
2. baseline-results.txt non-empty        (results captured)
3. build-baseline.log.frozen exists      (log snapshotted under a name no rebuild writes)
4. rebuild writes build-fix.log          (NEVER the baseline paths)
5. sha256sum -c baseline.sha256 passes   (pre-registration unmodified since before results existed)
```

Any check failing ⇒ the baseline is untrustworthy; re-establish from a pristine tree rather than reasoning about which parts are stale.

**Durability is load-bearing, not tidiness.** If the rebuild destroys the only record of the baseline, you end up *reconstructing* the baseline claim — which is exactly the claim the exercise exists to establish independently. A reconstructed baseline is not a baseline.

Also: **one consumer per artifact.** Two waiters polling the same binary is the same race in miniature; stop the redundant one.

## Spotting the next one

Ask of every step: *what am I treating as a snapshot, and who else can write it before I read it?* Candidates cluster around slow operations (builds, test runs, packaging, in-flight `git`) and around anything used as *evidence* — logs, result files, pre-registrations, hashes.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785824548562-gate-on-evidence-on-disk-not-on-intention-the-froz.md`_
