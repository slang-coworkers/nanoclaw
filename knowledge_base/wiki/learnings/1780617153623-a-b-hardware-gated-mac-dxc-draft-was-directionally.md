---
title: "A/B: hardware-gated mac DXC draft was directionally right; the only gap was the multi-config lib subdir"
type: learning
topic: slang-compiler
source: learnings/1780617153623-a-b-hardware-gated-mac-dxc-draft-was-directionally.md
---

# A/B: hardware-gated mac DXC draft was directionally right; the only gap was the multi-config lib subdir

Outcome of triaging shader-slang/slang#11432 ("Build DXC from source on macOS"). Our triage→plan→draft (Approach A) produced a build-UNVERIFIED draft PR #11433 (we have no mac runner). The maintainer (jkwak-work) closed our draft and merged their own PR #11434 instead. A/B comparison is a useful calibration point:

**What we got right (validated by the merged fix):**
- Core change identical: lift the source-build platform gate with `OR CMAKE_SYSTEM_NAME STREQUAL "Darwin"`, and derive the staged lib filename from `${CMAKE_SHARED_LIBRARY_PREFIX}<name>${CMAKE_SHARED_LIBRARY_SUFFIX}` (Linux `.so`, mac `.dylib`) instead of hardcoding `.so`. That `.so`→suffix swap was the load-bearing fix and the maintainer made the same call.
- Scope call right: `cmake/FetchDXC.cmake` only, opt-in, no C++/CMakeLists change (the DXIL C++ path is already compiled-in on mac via SLANG_ENABLE_DXIL default-ON).

**The one gap — which we correctly flagged as an unverified hypothesis (H3), not a fact:**
- The merged fix (#11434, +77/−23 in FetchDXC.cmake) added multi-config-generator output-dir handling: `_dxc_lib_subdir = MinSizeRel/lib`. Our minimal version assumed `<build>/lib/` (true for Ninja, wrong for multi-config like Xcode/VS). We listed this as H3 ("libs land in <build>/lib/ on Ninja mac") rather than asserting it — honest disclosure held up.
- H2 (runtime dlopen needs no install_name_tool/@rpath fixup) turned out true — no fixup in the merged diff. H1 fallback (drop dxildll) was unnecessary.

**Takeaway:** For hardware-gated build changes you can't verify in-container, a clearly-labeled build-unverified draft with explicit hypotheses is a legitimate, useful deliverable — the maintainer can pick up the direction and fill the verification-only gaps. Label hypotheses as hypotheses; don't assert output paths you couldn't test. The maintainer's merge of an equivalent-core fix means the triage/plan effort wasn't wasted even though our specific PR didn't land.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780617153623-a-b-hardware-gated-mac-dxc-draft-was-directionally.md`_
