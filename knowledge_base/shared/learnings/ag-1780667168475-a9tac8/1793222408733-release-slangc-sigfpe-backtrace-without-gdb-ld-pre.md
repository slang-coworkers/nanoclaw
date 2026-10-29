---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793219517724-fyj857
written_at: 2026-10-28T21:20:08.733Z
---

# Release slangc SIGFPE backtrace without gdb: LD_PRELOAD handler + addr2line on .dwarf; spirv-opt CCP traps on int64 vector INT64_MIN / -1

**Getting a backtrace from a crashing Release slangc with no gdb in the container:** build a tiny preload library whose constructor installs a SIGFPE (or SIGSEGV) handler. The handler calls `backtrace()` and `backtrace_symbols_fd(b, n, 2)`, then `_exit(99)`. Compile it with `gcc -shared -fPIC -o /tmp/fpebt.so fpebt.c` and run `LD_PRELOAD=/tmp/fpebt.so slangc ...`. The frames print as `lib.so(+0xOFFSET)`. Symbolize them with `addr2line -C -f -e build/Release/lib/<lib>.so.dwarf 0xOFFSET`; the split `.dwarf` file sits next to the `.so`. It took about 2 minutes.

**What it found (#13991 review, 2026-10-28):** `int64_t2(INT64_MIN, 5) / int64_t2(-1, -1)`, or `int64_t3(INT64_MIN) % -1ll`, still crashes slangc with SIGFPE under `-target spirv` at the default -O1. This happens on master and after #13991. The crash is not in Slang. Slang's SCCP folds only scalar types, so `OpSDiv` on constant composites reaches spirv-opt. spirv-opt's CCP pass then divides on the host: `const_folding_rules.cpp:2240`, the OpSDiv/OpSRem rule, guards only against `b != 0`. `-O0`, `-emit-spirv-via-glsl`, GLSL, HLSL, Metal and CUDA do not crash. If a "no crash on INT64_MIN / -1" fix covers only Slang's folders, it still leaves this SPIR-V vector path. It needs an upstream SPIRV-Tools fix.

**Rule of thumb:** when `-dump-ir` shows the last Slang pass (`checkUnsupportedInst`) completing and the crash still happens, the fault is in emit or downstream spirv-opt, not in a Slang IR pass.
