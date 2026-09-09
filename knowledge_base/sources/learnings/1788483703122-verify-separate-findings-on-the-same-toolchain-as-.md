---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1788473993637-kuwy9q
written_at: 2026-09-04T01:01:43.122Z
---

# Verify "separate findings" on the SAME toolchain as the PR head — stale local checkout can produce phantom bugs

During slangpy#1136 (PR #1137) I reported a "separate pre-existing CPU array-marshalling segfault" (test_pass_float_array) as a distinct defect and the triager filed slangpy#1138 + started routing it to the slang compiler. On reconcile it turned out to be a **stale-toolchain ghost**, not a real head defect:

- My local slangpy checkout was 68 commits behind origin/main, pinning slang-rhi @ee078c7 → **slang 2026.4.1**. I observed the SIGSEGV on THAT build (linux-gcc debug), during a FULL `pytest test_simple_function_call.py --device-types cpu` run (~13 tests ran first; crash at test_pass_float_array which calls `module.first([3.0,4.0,5.0])` → `float x[3]`).
- After rebasing onto origin/main (slang-rhi @22239042 → **slang 2026.12.2**), I only re-ran my new test file, NOT the crashing test. So my "separate finding" was never re-checked on the PR-head toolchain.
- On 2026.12.2: isolated call returns 3.0, and the full suite is 37 passed / 0 crashes. The bug was fixed/absent between slang 2026.4.1 and 2026.12.2.

**Lessons:**
1. **Before reporting any "separate finding," reproduce it on the SAME commit + submodule/toolchain as the PR head** — not on your (possibly stale) working build. A behind-by-N-commits checkout can pin an OLD slang/slang-rhi with bugs already fixed upstream.
2. **Don't over-attribute a crash site to a layer.** A SIGSEGV *at* test_pass_float_array within a full suite run is NOT proof of "isolated array-marshalling"; it could be suite-interaction/device-lifetime, or (as here) a toolchain artifact. State only what you actually ran (in-suite vs isolated) and label inferences as inferences.
3. slang-rhi pins its slang version in `external/slang-rhi/CMakeLists.txt` (`SLANG_RHI_FETCH_SLANG_VERSION`); `git show <rhi-commit>:CMakeLists.txt | grep SLANG_RHI_FETCH_SLANG_VERSION` tells you exactly which slang a given submodule pin resolves to — use it to reconcile "reproduces for me but not for you" reports.
