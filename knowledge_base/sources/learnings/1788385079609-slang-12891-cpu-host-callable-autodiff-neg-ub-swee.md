---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1788384057246-ndf79k
written_at: 2026-09-02T21:37:59.609Z
---

# slang #12891 -cpu/host-callable autodiff-neg UB sweep = MISS (x86_64, both sub-paths clean)

Ran the GPU-free x86_64 UB sweep the triager wanted for #12891 (suspected pre-existing negative-sign bug on `-cpu`/host-callable, autodiff `fwd_diff(-(x*x))` on a user `IFloat`). @ HEAD 53e0e2b58. **Outcome: MISS — no UB attributable to slang on either `-cpu` sub-path.** This narrows #12891 to a genuinely arch-dependent (aarch64) issue or a non-UB codegen difference; it is NOT #12879's `PathInfo::type` (HostVM-only, unreachable from `-cpu`, re-confirmed).

**How to drive the `-cpu`/host-callable path under sanitizers on x86_64 (reusable recipe):**
- The emitted downstream-C++ kernel is self-contained enough to compile+run standalone: `slangc repro.slang -entry <e> -stage compute -target cpp -o gen.cpp`, then a 12-line harness: `#include <cstdio>` + `#include "gen.cpp"` + `int main(){ ComputeVaryingInput vi={}; vi.endGroupID={1,1,1}; main_0(&vi,nullptr,nullptr); }`. The emitted `_main_0` ignores all three params, and `printf` in a `void main()` shader survives into the C++ (just add `<cstdio>` — the real slang-rhi CPU driver provides it). `ComputeVaryingInput` is in `prelude/slang-cpp-types.h`. Then compile with `-fsanitize=...` / run under valgrind. This is far cleaner than fighting slang-test's harness for a `main()`+printf repro.
- **clang-14 compiler-rt sanitizer runtimes are NOT installed here** (`libclang_rt.ubsan_standalone`/`msan` missing → link error). Use **gcc's own** `libubsan`/`libasan` (`/usr/lib/gcc/x86_64-linux-gnu/12/`) for UBSan/ASan. **MSan is unavailable** (gcc has none; clang msan lib missing) — but valgrind memcheck `--track-origins=yes` covers the same uninitialized-read class and is exactly what cracked #12871.
- **valgrind 3.19 can't read clang-14 DWARF-5** (`get_Form_szB: unhandled DW_FORM_rnglistx`, form 0x25) — detection still works but attribution is degraded; compile with **`-gdwarf-4`** for readable frames.
- To sweep the **LLVM-JIT** sub-path + real slang-rhi driver: `render-test` is an in-process tool lib (`librender-test-tool.so`) that slang-test dlopens, so `valgrind ./build/Debug/bin/slang-test <test>` (no `-use-test-server`) instruments the JIT'd kernel in-process (JIT exec-mem allocation shows in the log — proof it's under valgrind, not an un-instrumented child). Force the JIT path with directive flag `-xslang -emit-cpu-via-llvm` (NOT bare `-emit-cpu-via-llvm` — that goes to render-test which rejects it).
- **Known false positive to filter:** running any slang binary that `dlopen`s slang-llvm produces `Invalid read of size 8` in glibc `ld.so`: `strncmp` → `is_dst` → `decompose_rpath`/`_dl_dst_substitute` (RPATH `$ORIGIN` expansion), caller `Slang::SharedLibrary::loadWithPlatformPath` (slang-platform.cpp). Benign glibc over-read; ignore. Filter error contexts to slang/IR/autodiff/emit/JIT frames before concluding a HIT.

**Result detail:** emitted `s_fwd_MyFloat_neg_0` = `-differential`,`-primal` (d(−v)=−dv ✓); `IFloat.neg()` witness call specialized+inlined to a direct float negation for the concrete type — no CPP-specific negation site, no `kIROp_Neg` survivor. Clean under memcheck+UBSan+ASan × clang/gcc × O0/O1/O2; via-llvm JIT clean too. A deterministic emit sign bug would also hit CUDA (shared `CPPSourceEmitter`) and doesn't. Investigation-only: no fix PR (no failing test).
