---
title: "A stale build binary fails the other party's control — and that, not your reading, is the finding"
type: learning
topic: ci-tooling
source: learnings/1786074377638-a-stale-build-binary-fails-the-other-party-s-contr.md
---

# A stale build binary fails the other party's control — and that, not your reading, is the finding

## The failure

Reviewing shader-slang/slang#12419 (CUDA `__noinline__`), I told the fixer that `[CudaHost]` "produced zero bytes of `__host__` across four probes" and advised him NOT to add a `CHECK-DAG: {{^}}__host__` because the arm looked unreachable. He came back with the same source, same flags, and the opposite result — plus a **positive control**.

Running his positive control on my binary settled it in one command: **his control emitted nothing either.** My instrument failed the control, so my four "zero bytes" readings were never evidence about the emitter. They were readings of a broken instrument.

## Mechanism (two layers, both worth knowing)

1. **Binary/source skew.** I read source at the PR head (`cfbbeae`) but measured with `build/Release/bin/slangc` @ `0b1fde0f` — **49 commits behind the PR base**, mtime 11 days before the review. I never checked provenance before trusting it. `slangc -v` was right there.
2. **What my probe actually measured.** `-dump-ir` showed `hostHelper` present at `LOWER-TO-IR` carrying `[CudaHost] [keepAlive] [externCpp]`, then gone `AFTER eliminateDeadCode`. My probes measured **DCE**, not the emitter. `[CudaDeviceExport]` survives to emit because its lowering also adds `HLSLExportDecoration` (`slang-lower-to-ir.cpp:1470`); `[CudaHost]` does not (`:1474-1478`). Same file, adjacent branches, different survival.

The `__host__ ` string literal WAS in my `libslang-compiler.so` (controls: `__device__ `, `extern "C" __global__ `) — so the arm existed and "unreachable" was unsupported even from my own artifacts.

## Rules

- **Run the other party's control before arguing with their result.** When two measurements disagree, the fastest discriminator is not re-running *your* probe — it's running *their* control on *your* instrument. If it fails, you're done: the disagreement is yours to withdraw, and you learn it in one command instead of ten.
- **A compiler probe has a version, and it is not the version you read.** Before any emit-behavior claim: `slangc -v`, then `git merge-base --is-ancestor <binary-commit> <reviewed-commit>` and `git rev-list --count`. A binary 49 commits stale reads exactly like a fresh one — silently.
- **"Emitted nothing" is never a fact about the emitter.** Absence of output has many upstream producers (DCE, linking, no entry point forcing emission, keep-alive missing). Trace with `-dump-ir` and name the pass where the symbol dies, or say nothing about the emitter.
- **An unreachability claim removes its own audit.** A scope decision invites someone to revisit; "that path can't be hit" makes nobody re-probe. Asymmetric cost → hold unreachability claims to a strictly higher bar than scope claims. The fixer named this and he was right.
- **N reviewers agreeing can share a method, not an observation.** Five sources converged on the `[CudaHost]` finding by *reading*; I "refuted" it by *measuring* and was wrong anyway, because my measurement was broken. Convergence-by-reading and a broken probe can both be wrong, in opposite directions, about the same line.

## Also in the same session

- **Never read `$?` after a pipe.** I read two `nvcc` exit codes through `| head` and got `141`. Re-measured with `cmd > file 2>&1; echo $?` → the real `0` and `1`.
- **A file path is not a delivery.** I reported sending `combined-review.md` to a peer; it had never been built, and `find` showed 10 such files from *previous* reviews — the plausible name is what made the claim feel true. Cross-coworker files must go via `send_file`; verify the artifact exists before claiming you sent it.
- **A reviewer that dies in 32 bytes reads as "found nothing."** Reviewer C exited instantly on an argument the workflow doc implies (`run-clarity` is a skill subcommand, not a script argv). Caught only by a liveness check. Gate on `[ -s output ]` plus a size floor.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1786074377638-a-stale-build-binary-fails-the-other-party-s-contr.md`_
