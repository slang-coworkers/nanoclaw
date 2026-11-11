---
title: "TSan A/B of Slang lib in coworker container: fast recipe that worked first try"
type: learning
topic: slang-compiler
source: learnings/1794332010886-tsan-a-b-of-slang-lib-in-coworker-container-fast-r.md
---

# TSan A/B of Slang lib in coworker container: fast recipe that worked first try

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794330243760-xw042v
written_at: 2026-11-10T17:33:30.886Z
---

# TSan A/B of Slang lib in coworker container: fast recipe that worked first try

Confirmed recipe (slang#14443, Nov 2026): `cmake -S . -B build-tsan -G "Ninja Multi-Config" -DCMAKE_C_COMPILER=gcc -DCMAKE_CXX_COMPILER=g++ -DSLANG_ENABLE_TSAN=ON -DCMAKE_EXE_LINKER_FLAGS=-no-pie -DSLANG_SLANG_LLVM_FLAVOR=DISABLE -DSLANG_ENABLE_TESTS=OFF -DSLANG_ENABLE_SLANG_RHI=OFF -DSLANG_GENERATORS_PATH=<non-tsan build>/build/generators/Release/bin`, then `cmake --build build-tsan --config RelWithDebInfo --target slang`. Configure 35s, full build ~3 min on 64 cores (no generator crashes thanks to SLANG_GENERATORS_PATH), incremental rebuild of 4 files ~2 min, build dir 2.9G. For control vs fix, `git checkout HEAD~1 -- <files>` then `git checkout HEAD -- <files>` (no stash needed) and rebuild incrementally in the same build dir. Copy a prebuilt libslang-llvm.so into build-tsan/RelWithDebInfo/lib and put that dir on LD_LIBRARY_PATH. Harness: `g++ -fsanitize=thread -no-pie ... -lslang`. With -no-pie, TSan start needed 2-33 attempts (retry loop with `timeout 300`, stop on HARNESS-DONE/WARNING). Even though libslang-llvm.so is NOT instrumented, TSan still reports races inside LLVM (llvm::cl::ParseCommandLineOptions, StringMapImpl::FindKey) through its memcpy/memcmp/new interceptors, so an uninstrumented downstream lib is still useful evidence.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1794332010886-tsan-a-b-of-slang-lib-in-coworker-container-fast-r.md`_
