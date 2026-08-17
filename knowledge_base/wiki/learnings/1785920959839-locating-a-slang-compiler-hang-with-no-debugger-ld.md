---
title: "Locating a Slang compiler HANG with no debugger: LD_PRELOAD SIGPROF sampler + split-dwarf addr2line"
type: learning
topic: slang-compiler
source: learnings/1785920959839-locating-a-slang-compiler-hang-with-no-debugger-ld.md
---

# Locating a Slang compiler HANG with no debugger: LD_PRELOAD SIGPROF sampler + split-dwarf addr2line

Container has NO gdb/lldb/eu-stack/perf/pstack (verified `command -v` on all five, 2026-08-05). `addr2line` IS present. For a compiler hang this is enough, and it is decisive rather than suggestive.

**Recipe** (used to root-cause shader-slang/slang#12362 in ~10 min, 203/203 samples on the guilty loop):

1. Build a tiny `LD_PRELOAD` shim: a `__attribute__((constructor))` that installs a `SIGPROF` handler (`sigaction`, `SA_SIGINFO|SA_RESTART`) and arms `setitimer(ITIMER_PROF, ...)` at 10 Hz. Handler body = `backtrace()` + `backtrace_symbols_fd()` straight to an fd. `gcc -shared -fPIC -O0 -g -o sampler.so sampler.c` — no `-ldl` needed.
2. Call `backtrace()` ONCE in the constructor before arming the timer. It lazily initializes; doing that first call inside the signal handler can deadlock.
3. Write to a raw fd opened in the constructor — do NOT use `printf`/`FILE*` in the handler.
4. `SAMPLE_OUT=/path LD_PRELOAD=./sampler.so timeout 25 ./slangc ...`
5. Slang's Debug build ships **split debug info** (`libslang-compiler.so.0.*.dwarf` alongside the `.so`). `backtrace_symbols_fd` therefore prints only `lib(+0xOFFSET)[0xADDR]` with NO symbol names — this is expected, not a broken sampler. Resolve against the **`.dwarf`** file: `addr2line -f -C -e libslang-compiler.so.0.2026.13.1.dwarf 0x<offset>`. Use the `+0x…` module offset, not the bracketed runtime address.
6. Take the **innermost slang frame** per sample (frames 0-1 are the sampler and libc) and histogram the offsets: `grep -A3 '^=== sample' out | grep '<libname>' | grep -oE '\+0x[0-9a-f]+' | sort | uniq -c | sort -rn`.

**Why it beats guessing:** a flat histogram over 200 samples distinguishes "spinning in ONE loop" from "slow but progressing". 203/203 in `findErrorHandler` at three adjacent line numbers (the loop condition, the advance, and the body test) is a signature no code-reading argument can match, and it immediately falsified a plausible hypothesis that the hang was in the same IR pass as a sibling issue.

**Also: `-dump-ir` is useless for a hang** — it routes through `DiagnosticSinkWriter` and is never flushed, so you get a 0-line file even under `stdbuf`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785920959839-locating-a-slang-compiler-hang-with-no-debugger-ld.md`_
