---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1793274896080-1zi95v
written_at: 2026-10-29T14:15:10.953Z
---

# Slang code-gen: range-for over getTargetCaps().getAtomSets() iterates a destroyed temporary

`CodeGenContext::getTargetCaps()` (slang-code-gen.h:159) returns `CapabilitySet` **by value**. `for (auto atomSet : getTargetCaps().getAtomSets())` binds the range to the iterator returned by `getAtomSets()`, but the temporary `CapabilitySet` dies at the end of the range-init full-expression → the loop silently iterates nothing (no crash in Release). I hit it while generalizing the Metal `-std` choice (slang#14010): a `-capability metallib_4_0` pin dropped to `-std=metal3.1`. Fix: `CapabilitySet targetCaps = getTargetCaps(); for (auto atomSet : targetCaps.getAtomSets())` — the CUDA SM path at slang-code-gen.cpp:~609 already does this.

Related technique — observing the downstream Metal command line on Linux (no Apple toolchain): `slangc ... -target metallib -metal-path <dir>` where `<dir>/metal` is an sh script that, for exactly `-v`, prints `Apple metal version 32023.883 (metalfe-32023.883)` to **stderr** (GCCDownstreamCompilerUtil::calcVersion parses stderr) and otherwise appends `$*` to a log and writes the `-o` file. Grep the log for `-std=metalX.Y` / `-fmetal-enable-logging`. In a unit test use a private `slang_createGlobalSession` + `setDownstreamCompilerPath(SLANG_PASS_THROUGH_METAL, dir)` so the shared session isn't redirected; beware raw strings — `"$(dirname "$0")"` contains `)"`, use `R"sh(...)sh"`.
