---
title: "Native backtrace without gdb: libc backtrace_symbols_fd + .dwarf sidecar (settled slangpy#820 attribution -> slang#12392)"
type: learning
topic: slang-compiler
source: learnings/1786023645422-native-backtrace-without-gdb-libc-backtrace-symbol.md
---

# Native backtrace without gdb: libc backtrace_symbols_fd + .dwarf sidecar (settled slangpy#820 attribution -> slang#12392)

## The problem

A deterministic rc=139 segfault inside `libslang-compiler`, reached from Python. `faulthandler` only reaches the nanobind boundary (`calldata.py:524`), which tells you *which Python call* died but nothing about *whose code* faulted — so slangpy-vs-Slang attribution stays unresolved and the bug sits unowned. `gdb` was **not installed** and `apt-get download gdb` returned "no candidate"; an `install_packages` request needs admin approval and didn't land in time.

## Technique 1 — get a native backtrace with no debugger

Python side, via `ctypes` (install a C-level SIGSEGV handler that calls `backtrace_symbols_fd(2)` before dying):

```python
import ctypes, os, signal
libc = ctypes.CDLL("libc.so.6", use_errno=True)
frames = (ctypes.c_void_p * 64)()
HANDLER = ctypes.CFUNCTYPE(None, ctypes.c_int)
def _h(sig):
    n = libc.backtrace(frames, 64)
    libc.backtrace_symbols_fd(frames, n, 2)
    os._exit(139)
cb = HANDLER(_h)
libc.signal(signal.SIGSEGV, ctypes.cast(cb, ctypes.c_void_p))
```

For a **standalone binary** (no Python), same idea via `LD_PRELOAD` — more robust, no ctypes trampoline:

```c
// gcc -shared -fPIC -o seghandler.so seghandler.c
#define _GNU_SOURCE
#include <execinfo.h>
#include <signal.h>
#include <unistd.h>
static void h(int sig){ void*b[64]; int n=backtrace(b,64);
  write(2,"\n=== BT ===\n",12); backtrace_symbols_fd(b,n,2); _exit(139); }
__attribute__((constructor)) static void init(void){ signal(SIGSEGV,h); }
```
```bash
LD_PRELOAD=./seghandler.so ./slangc ... 2>&1 | sed -n '/=== BT ===/,$p'
```

Cores were useless here: `/proc/sys/kernel/core_pattern` pipes to apport, whose dumps I can't read. Don't waste time on `ulimit -c`.

## Technique 2 — symbolize offsets with the shipped .dwarf sidecar

The backtrace prints bare `lib(+0xOFFSET)` because the stripped `.so` has `.gnu_debuglink` and no symtab. **Check for a `.dwarf` sidecar next to the library before rebuilding anything** — slang ships them:

- `<slangpy>/build/linux-gcc/Release/libslang-compiler.so.0.2026.12.dwarf`
- `<slang>/build/Release/lib/libslang-compiler.so.0.2026.14.1.dwarf` (346 MB)

```bash
addr2line -f -C -e libslang-compiler.so.0.2026.12.dwarf 0xab5793
# -> Slang::EntryPointInParamToBorrowContext::shouldTransformParam(Slang::IRParam*)
#    source/slang/slang-ir-transform-params-to-constref.cpp:466
```

That turned 10 anonymous frames into a named call chain and settled attribution in minutes. **A full debug rebuild (15-30 min) was unnecessary.** Match the sidecar to the *loaded* library version — slangpy vendors its own `libslang-compiler` (2026.12), which is NOT the version in a sibling slang checkout (2026.14.1); the wrong sidecar yields plausible-looking garbage.

## Result

`sgl::Device::create_compute_pipeline` → `rhi::ShaderProgram::compileShaders` → `ComponentType::getEntryPointCode` → `emitEntryPointsSourceFromIR` → `linkAndOptimizeIR` → **`shouldTransformParam` → `IRUse::get()` → SIGSEGV**.

Root cause: the pass `SLANG_ASSERT`s `IRLayoutDecoration`, guards `if (!layoutDecoration) return false;`, then dereferences `layoutDecoration->getLayout()` on the **next line**. In Release the assert compiles out, so the "be defensive in release builds" intent stated in its own comment is defeated by the immediately following deref. Filed **shader-slang/slang#12392**.

## Technique 3 — escalate a runtime crash into a command-line repro

A `slangc`-only repro is worth far more upstream than "call this Python API". Path that worked: dump the generated shader (`SLANGPY_DUMP_SLANG_INTERMEDIATES=1`), notice it `import`s the in-memory user module, **hand-write that module to disk**, then compile the pair with `-I .`. From there, minimize. Final repro = 2 files, no Python/GPU/slangpy:

```slang
// inner.slang
[shader("compute")] [numthreads(32,1,1)]
void k(uint tid, RWStructuredBuffer<float> buf) { buf[tid] = tid*2.0; }
// outer.slang
import inner;
[shader("compute")] [numthreads(32,1,1)]
void compute_main(int3 t: SV_DispatchThreadID, uniform uint tid, uniform RWStructuredBuffer<float> buf) { k(tid, buf); }
```
Trigger: **an entry point calling a function that is itself an entry point.** Control (drop the two attributes) → rc=0.

## The trap that nearly produced a wrong upstream issue

My first minimized single-file version **also** crashed — but symbolizing showed a **different** fault: `GlslangDownstreamCompiler::_invoke`, `-target spirv` only. Same trigger shape, **two distinct bugs**. Had I filed with that file I'd have handed the Slang team a repro that doesn't exercise the reported frame.

**Rule: symbolize every "successful" reproduction and confirm the frame matches the bug you're reporting.** Same exit code + same trigger shape ≠ same bug. I only trusted the minimal repro once `addr2line` showed `shouldTransformParam` / `IRUse::get()` on it too.

Also: `rc=124` is `timeout`'s exit code, not a crash. A 2026.14.1 run returned 124 and it would have been easy to write "fixed in newer" — it hung or was slow, unverified in both directions. Don't convert a timeout into a version verdict.

## Environment note

`gh auth status` reports *"The token in GH_TOKEN is invalid"* for the `nv-slang-bot[bot]` App token while `gh issue view` / `gh issue create` work fine. **Test an actual read before believing that error** — it's a status-command artifact for App tokens, not a broken token.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786023645422-native-backtrace-without-gdb-libc-backtrace-symbol.md`_
