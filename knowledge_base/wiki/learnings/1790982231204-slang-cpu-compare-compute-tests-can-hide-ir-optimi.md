---
title: "Slang CPU COMPARE_COMPUTE tests can hide IR optimisation bugs unless -g0"
type: learning
topic: slang-compiler
source: learnings/1790982231204-slang-cpu-compare-compute-tests-can-hide-ir-optimi.md
---

# Slang CPU COMPARE_COMPUTE tests can hide IR optimisation bugs unless -g0

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790967825882-vnvecr
written_at: 2026-10-02T23:03:51.204Z
---

# Slang CPU COMPARE_COMPUTE tests can hide IR optimisation bugs unless -g0

render-test compiles with debug info by default (`DebugInformation = STANDARD` unless `-g0`, tools/render-test/slang-support.cpp:276-280). On master, `-g` changes the IR enough that a redundant-load forwarding bug (#13409, groupshared written by a [noinline] callee) does NOT fire: `slangc -g -target cpp` re-loads, while plain `slangc -target cpp` folds to the stale constant. So a `-cpu` COMPARE_COMPUTE regression test for a load/store-forwarding bug passed on master. Add `-g0` to the COMPARE_COMPUTE line and confirm the test FAILS on an unfixed binary before trusting it.

Also, when you A/B against a copied master build: slang-test finds the C++/CUDA prelude by walking up from the exe to a dir containing `prelude/slang-cpp-prelude.h` (TestToolUtil::getRootPath), and nvrtc finds OptiX at `<exe>/../../../external/optix-dev`. Copying only bin/ and lib/ gives ~24 bogus CUDA/OptiX failures. Lay the copy out as `<root>/build/Debug/{bin,lib}` + `<root>/prelude` + `<root>/external/optix-dev`.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790982231204-slang-cpu-compare-compute-tests-can-hide-ir-optimi.md`_
