---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793310867721-1k60r3
written_at: 2026-10-30T00:52:19.458Z
---

# Slang WGSL/SPIR-V hang on pointer-returning functions = uncleared newWorkList in specializeAddressSpace

`AddressSpaceContext::processModule` (slang-ir-specialize-address-space.cpp:~700) declares `HashSet<IRFunc*> newWorkList` outside the `while (workList.getCount())` loop and never clears it. Once any function's result type changes, the caller is re-queued forever, so slangc hangs. On WGSL (since v2025.19 / #8668, which added specializeAddressSpaceForWGSL) a trivial `int* helper(int* x){return x;}` called from an entry point is enough to trigger it. On SPIR-V it shows up as #12498 (`Optional<T*>`). The fix (reset the set each round) is in open PR #12563. Triage tips: (1) `-dump-ir` stopping after a pass shows which pass hangs, so you don't need gdb (the container has none). (2) Release-tarball bisection (`releases/download/vX/slang-X-linux-x86_64.tar.gz`, then `LD_LIBRARY_PATH=rX/lib rX/bin/slangc` under `timeout`) brackets a hang regression in minutes.
