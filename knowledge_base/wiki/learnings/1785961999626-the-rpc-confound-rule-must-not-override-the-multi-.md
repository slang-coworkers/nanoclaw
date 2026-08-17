---
title: "The rpc-confound rule must not override the multi-platform tell — reproduction across hosts/attempts is the discriminator"
type: learning
topic: misc
source: learnings/1785961999626-the-rpc-confound-rule-must-not-override-the-multi-.md
---

# The rpc-confound rule must not override the multi-platform tell — reproduction across hosts/attempts is the discriminator

## The defect

Slang CI has a documented confound: a JSON-RPC test-server transport death makes the *same* test names fail on *both* Linux and Windows, which superficially mimics the "consistent multi-platform failure ⇒ LEGITIMATE" tell. The stored rule says: don't trust the multi-platform tell, check for `JSON RPC failure: sendCall()` / `waitForResult()` / `rpc failed` / `result code = 0` with empty stderr+stdout, because that pattern IS intermittent and recoverable.

On 2026-08-05 I applied that rule to PR #12354 and **reran a real regression**. The rpc signatures were genuinely present, so the confound rule fired and I overrode the correct legitimate verdict.

## Why the confound rule mis-fired

**The rpc signature is not evidence of causation — it appears on legs that PASS.** On the same commit, the sibling `test-linux-release-gcc-x86_64 / test-slang` job logged 4 `JSON RPC failure` occurrences and still finished `100% of tests passed (7129/7129)`. So presence-of-rpc-strings has near-zero discriminating power on its own; it is background noise layered over whatever else is happening.

What actually happened: the PR added `-DSLANG_ENABLE_VALIDATION_FOSSIL=ON` to its CI build invocations, and `source/slang/slang-fossil.h` makes that macro swap `SLANG_ASSERT(CONDITION)` → `SLANG_UNEXPECTED("invalid format encountered in serialized data")` — fail-fast in **release** too. The tests spawn a `slangc` child; the child aborts on the new fossil check; the channel dies. **The abort produces the rpc-death symptom.** So the confound's signature is the *downstream* appearance of the real bug, which is why it is retry-resistant and why grepping for it confirms the wrong hypothesis.

## The discriminator: did it reproduce across hosts AND attempts?

- **Flake:** fails on one host, clears (or moves) on rerun.
- **Regression:** same test names, same tallies, different hosts, multiple attempts.

For #12354 the same 3 tests (`SlangcSeparateDebugInfoOutput`, `SlangcReadFromStdin`, `SlangcCoverageManifestOutput`) failed with byte-identical tallies (`7124/7127` linux, `11455/11458` win-release) on **4 distinct runners across 2 attempts** — including the attempt *my own rerun* created. A failure that survives your own rerun has already falsified the flake hypothesis; no amount of matching signature text rescues it.

## How to apply

1. The multi-platform tell is the **default**; the rpc confound is the exception, and it requires positive evidence of *recovery*, not merely presence of rpc strings.
2. Before invoking the confound, run the **passing-leg control**: grep the same signature in a sibling job on the same sha that SUCCEEDED. If it's there too, the signature is noise — discard it as evidence.
3. Add the **cross-PR control**: same job names on an unrelated PR. Green there ⇒ the tests are healthy on adjacent code ⇒ look at the diff.
4. **Check whether the diff supplies a causal mechanism** before concluding infra. A CI-flag/build-option change (`-D...=ON`) counts as reaching the test even when no test-adjacent source file was touched — my usual "diff can't reach this subsystem" attribution shortcut fails on build-configuration diffs, because they change the semantics of code that *is* compiled.
5. Emitted-bytes reminder that mattered here: the failure marker is uppercase `FAILED test:`. A lowercase grep returns a **false zero** against a tally that plainly shows 3 failures.

## Generalization

A rule of the form "signature X means intermittent" is only sound if X is **absent from healthy runs**. When X can co-occur with success, the rule silently converts into "ignore the strongest legitimate tell," and the failure mode is the worst kind: you rerun a real regression and the red looks like infra noise to everyone downstream. When adopting any signature-based exception rule, first ask what its **false-positive rate on passing jobs** is, and construct the passing-leg control that measures it.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785961999626-the-rpc-confound-rule-must-not-override-the-multi-.md`_
