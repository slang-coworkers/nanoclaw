# Proving a null-function-pointer crash: stub .so + SA_SIGINFO, and why a truncated backtrace IS the signature

## Problem

A code-reading bug report claimed an unguarded optional-symbol call crashes. Severity hinged entirely on
whether the path is reachable — crash vs hygiene. No debugger in the container (`gdb`, `lldb`, `eu-stack`
all absent, no root), so the source read could not settle it.

## Technique (no debugger needed)

**1. Stub the shared library, omitting exactly one symbol.** Slang resolves 9 symbols from
`libslang-glslang-<ver>.so` via `findFuncByName`, tolerating nulls. A ~15-line `g++ -shared -fPIC` stub
exporting 8 of 9 isolates one symbol as the independent variable:

```cpp
extern "C" { int glslang_compile(void*){return 1;} /* ...8 total... */ }
// glslang_linkSPIRV DELIBERATELY ABSENT
```

Verify the stub itself before using it: `nm -D --defined-only stub.so | grep -c <missing>` → **0**, and a
present symbol → **nonzero**. A stub you did not check is not a control.

Inject via the product's own option (`-spirv-opt-path <dir>`) rather than `LD_LIBRARY_PATH` — the binary's
RUNPATH was `$ORIGIN/../lib`, which wins over `LD_LIBRARY_PATH`.

**2. Capture the fault with `LD_PRELOAD` + `SA_SIGINFO`** when there is no debugger:

```c
static void h(int s, siginfo_t* si, void* uc){
  greg_t pc = ((ucontext_t*)uc)->uc_mcontext.gregs[REG_RIP];
  /* print si->si_addr and pc, then _exit */ }
__attribute__((constructor)) static void init(void){ /* sigaction(SIGSEGV,...) with SA_SIGINFO */ }
```

Result: `si_addr=(nil)`, **`RIP=0x0`**.

## ⭐ The counter-intuitive part

My first attempt used `backtrace()`/`backtrace_symbols_fd()` and returned only **2 useless frames** (handler
+ libc trampoline). I nearly treated that as a failed instrument.

**The truncation IS the evidence.** Calling through a null function pointer sets PC to 0, so there is no
frame to unwind — an empty backtrace is what this failure mode looks like. `RIP=0x0` then distinguishes it
positively from a *data* null-deref, which would fault at a real PC inside a real function. Reporting "null
deref" vs "call through a null function pointer" are different claims; only the register settles it.

## Matrix, with both controls

| library | modules | result |
|---|---|---|
| real | 2 | exit 0 (control: path works) |
| **stub** | **2** | **exit 139 SIGSEGV** |
| stub | 1 | exit 255 + graceful diagnostic (control: stub alone is not the cause) |
| real | 1 | exit 0 |

Both controls are load-bearing. Without the stub/1-module cell, "the stub breaks everything" is unexcluded.

⚠ Two harness traps hit on the way: (a) `cd`-ing then invoking `./build/...` broke the relative path and the
pipeline's exit code masked it as `EXIT=0` — check `PIPESTATUS`, and read the control cell first; (b) two
early isolation cells failed **identically for stub and real library**, i.e. the error was unrelated to the
variable — a cell that fails the same way in both arms carries zero information.

## Reusable

Any "optional symbol / capability tolerated as absent, but consumer assumes present" defect. In-tree
alternative for unit tests: `ISession::setSharedLibraryLoader()` (public API) to inject a fake loader.
