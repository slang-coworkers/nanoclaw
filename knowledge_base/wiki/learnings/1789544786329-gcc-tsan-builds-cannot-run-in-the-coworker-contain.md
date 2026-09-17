---
title: "GCC TSan builds cannot RUN in the coworker container (ASLR); use SLANG_GENERATORS_PATH to even build"
type: learning
topic: slang-compiler
source: learnings/1789544786329-gcc-tsan-builds-cannot-run-in-the-coworker-contain.md
---

# GCC TSan builds cannot RUN in the coworker container (ASLR); use SLANG_GENERATORS_PATH to even build

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787565793093-np84lo
written_at: 2026-09-16T07:46:26.329Z
---

# GCC TSan builds cannot RUN in the coworker container (ASLR); use SLANG_GENERATORS_PATH to even build

Empirical finding while validating slang#12707's `-DSLANG_ENABLE_TSAN=ON` (GCC 12, `libtsan.so.2`).

**Blocker: no GCC-TSan process can start here.** Any `-fsanitize=thread` binary (even a 10-line smoke test) dies at runtime init with `FATAL: ThreadSanitizer: unexpected memory mapping 0x...-0x...` before `main()`. Cause: the container's high-entropy ASLR (`vm.mmap_rnd_bits`) is incompatible with GCC 12's libtsan. It is effectively deterministic (smoke test 0/10 success; `slang-test` 0/N; `slangc` ~1/10). Every mitigation is blocked in-container:
- `sysctl -w vm.mmap_rnd_bits=28` → permission denied
- `echo 0 > /proc/sys/kernel/randomize_va_space` → read-only FS
- `setarch $(uname -m) -R <cmd>` → `personality()` EPERM (seccomp)
- `unshare -Ur ...` → EPERM (user namespaces disabled)
- Only `libtsan.so.2` exists (no gcc-13/14, no clang tsan runtime). Newer libtsan/compiler-rt (gcc≥13 / clang≥16) supports high-entropy ASLR but needs install_packages (admin).

So TSan runtime testing must happen on a host with `--privileged`/`seccomp=unconfined`, lower `vm.mmap_rnd_bits`, or `setarch -R` available.

**Building with TSan still works, with a workaround.** The build's own instrumented generator tools (`slang-embed`, etc.) hit the same startup crash, so `cmake --build` fails at prelude generation with the TSan FATAL. Fix without editing source: build generators non-TSan and import them via Slang's cross-compile hook:
1. `cmake -S . -B build-gen -G "Ninja Multi-Config" -DCMAKE_C_COMPILER=gcc -DCMAKE_CXX_COMPILER=g++ -DSLANG_ENABLE_TSAN=OFF -DSLANG_SLANG_LLVM_FLAVOR=DISABLE -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_SLANG_RHI=OFF`
2. `cmake --build build-gen --config Release --target all-generators`
3. `cmake -S . -B build -DSLANG_GENERATORS_PATH=$PWD/build-gen/generators/Release/bin` (keeps TSan ON; all generators become IMPORTED, so none get instrumented)
4. build normally. Verified: `slang-test`/`slangc` link `libtsan.so.2`; `libslang.so` has __tsan_ syms; `libslang-glslang` has 0 (SKIP_SANITIZERS boundary intact).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789544786329-gcc-tsan-builds-cannot-run-in-the-coworker-contain.md`_
