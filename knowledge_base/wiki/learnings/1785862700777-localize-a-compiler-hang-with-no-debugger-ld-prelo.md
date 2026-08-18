---
title: "Localize a compiler hang with no debugger: LD_PRELOAD SIGPROF sampler + addr2line"
type: learning
topic: slang-compiler
source: learnings/1785862700777-localize-a-compiler-hang-with-no-debugger-ld-prelo.md
---

# Localize a compiler hang with no debugger: LD_PRELOAD SIGPROF sampler + addr2line

## Situation

Triaging shader-slang/slang#12343 (compiler hang). No debugger available in the container:
`gdb`, `lldb`, `pstack`, `eu-stack`, `perf` ALL absent; `apt-get install gdb` → "no installation
candidate"; no root (`sudo` needs a password). `-dump-ir` is useless for a hang because the IR dump
routes through the diagnostic sink (`slang-pass-wrapper.cpp` → `DiagnosticSinkWriter`) and is never
flushed when the process never finishes — I got a 0-line dump file even with `stdbuf -o0`.

## What worked — build your own sampling profiler

~30 lines of C, no privileges needed:

```c
#define _GNU_SOURCE
#include <execinfo.h>
#include <signal.h>
#include <sys/time.h>
#include <unistd.h>
#include <fcntl.h>
#include <stdio.h>
static int g_fd = -1; static int g_count = 0;
static void handler(int sig) {
    (void)sig; if (g_count >= 80) return;
    void *bt[64]; int n = backtrace(bt, 64);
    char hdr[64]; int hl = snprintf(hdr, sizeof(hdr), "\n=== SAMPLE %d (frames=%d) ===\n", g_count, n);
    write(g_fd, hdr, hl); backtrace_symbols_fd(bt, n, g_fd); g_count++;
}
__attribute__((constructor)) static void setup(void) {
    g_fd = open("/tmp/stacks.txt", O_WRONLY|O_CREAT|O_APPEND, 0644);
    struct sigaction sa; sa.sa_handler = handler; sigemptyset(&sa.sa_mask); sa.sa_flags = SA_RESTART;
    sigaction(SIGPROF, &sa, 0);
    struct itimerval it;
    it.it_value.tv_sec = 4; it.it_value.tv_usec = 0;          /* first sample after 4s of CPU */
    it.it_interval.tv_sec = 0; it.it_interval.tv_usec = 200000; /* then every 200ms */
    setitimer(ITIMER_PROF, &it, 0);
}
```

```bash
gcc -shared -fPIC -o sampler.so sampler.c
LD_PRELOAD=./sampler.so timeout 30 ./build/Debug/bin/slangc <args> >/dev/null 2>&1
```

`ITIMER_PROF` fires on **CPU time**, so it only samples while actually spinning. Symbolize the
`libX.so(+0xOFFSET)` values with `addr2line -f -C -e <the .so> 0xOFFSET` — the offsets from
`backtrace_symbols_fd` are library-relative, which is exactly what `addr2line` wants. Get op/enum
names printed as names not integers where the codebase offers a helper (in Slang:
`getIROpInfo(inst->getOp()).name` — turned an opaque `op=635` into `extractExistentialWitnessTable`,
which is what made the mechanism legible).

**The distribution is the finding, not any single stack.** 80/80 samples on one line-range, and
**zero** samples in any of the 5 sibling sub-transforms, is what killed the plausible competing
theory (a subagent's "the outer `for(;;)` fixpoint oscillates, add an iteration cap"). One stack
would not have refuted it. An iteration cap on an outer loop cannot terminate an inner `while` that
never exits — it would have masked the bug.

## Cheap discriminators to run first

- **RSS flat + utime climbing linearly ⇒ spinning; RSS growing ⇒ runaway allocation.** One
  `/proc/<pid>/status` + `/proc/<pid>/stat` sampling loop separates those two worlds in 20 seconds
  and costs nothing:
  `UT=$(awk '{print $14}' /proc/$PID/stat); RSS=$(awk '/VmRSS/{print $2}' /proc/$PID/status)`
- **Narrow the phase with flags before reading any code.** `-skip-codegen` still hanging, and
  `slangc file.slang -o file.slang-module` (no `-target`, no `-entry`) still hanging, placed the bug
  before codegen and target-independent. ⚠ Pair such a flag with a **control proving the flag takes
  effect** — I confirmed `-skip-codegen` by checking the *passing* variant emitted 0 bytes with it
  vs full HLSL without it. A flag that silently does nothing gives you a confident wrong answer.

## Then confirm the mechanism with instrumentation, and print BOTH lists

Sampling gives you the line; it does not give you *why*. Temporary `fprintf` + `abort()` in-tree
did. Two things mattered:

- A **counter that aborts at N** turns an infinite loop into a readable failure carrying its own
  diagnosis: `innerHere=200001 merges=1 block==successor=0` simultaneously proved runaway-on-first-
  iteration AND refuted my own self-branch hypothesis.
- Printing the **before/after state of both data structures** each step showed the actual cycle. The
  root cause was a walk over a linked list that a callee mutated across containers: from step 2 on,
  the iteration variable's parent was already the *destination*, so move-to-end merely rotated the
  destination list forever.

Beware: `auto next = inst->getNextInst()` looks like the standard safe-erase idiom, and it is
safe against removing the *current* node — but not against a callee re-parenting *other* nodes.

## Gotchas that cost me real time

- `SLANG_UNUSED`-style shadowing: naming a probe variable `next` inside a scope before the real
  `next` is declared resolved to `std::next` and produced a wall of unrelated template errors.
- `cmd >log 2>&1 || tail log; echo "EXIT=$?"` reports **tail's** exit status, not the build's.
  Capture immediately: `cmd >log 2>&1; BE=$?`.
- `/tmp` can be wiped mid-session by external cleanup — I lost scratch files and had to recreate
  them. Put durable triage scratch under the agent workspace, not `/tmp`.
- Slang `-v` prints a **configure-time** `git describe` string, so it can name an ancestor commit
  and look like a stale binary when the binary is fine. Judge freshness by **object-file mtime vs
  HEAD commit date**, and when the binary IS older, scope the staleness to the claim:
  `git diff <binary-sha> HEAD -- <the file you're citing>` empty ⇒ still valid for that claim.

## Before/after discipline that made the result trustworthy

- **Prove the baseline still fails.** I stashed the candidate fix, rebuilt, and confirmed the hang
  returned — otherwise "4,287 tests pass" is vacuous.
- **Prove the regression test is not a no-op guard.** The new test must FAIL (here: hang, killed at
  180s ⇒ exit 143) on unpatched source. A test that passes both with and without the fix guards
  nothing.
- **Restore the tree and rebuild.** Leaving a fix baked into shared binaries silently changes the
  next session's baseline. Confirm restoration *behaviorally* (repro hangs again), not just by
  `git status`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785862700777-localize-a-compiler-hang-with-no-debugger-ld-prelo.md`_
