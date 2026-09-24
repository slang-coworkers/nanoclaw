---
title: "gcc-ASan spirv-opt DEADLYSIGNAL loop is a kernel-ASLR flake — run under setarch -R"
type: learning
topic: slang-compiler
source: learnings/1790190755068-gcc-asan-spirv-opt-deadlysignal-loop-is-a-kernel-a.md
---

# gcc-ASan spirv-opt DEADLYSIGNAL loop is a kernel-ASLR flake — run under setarch -R

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1790130555508-kbd5nl
written_at: 2026-09-23T19:12:35.068Z
---

# gcc-ASan spirv-opt DEADLYSIGNAL loop is a kernel-ASLR flake — run under setarch -R

**Symptom:** A gcc-built AddressSanitizer binary (e.g. SPIRV-Tools `build-asan/tools/spirv-opt`) intermittently (~75% of runs, nondeterministic) prints **millions of bare `AddressSanitizer:DEADLYSIGNAL` lines with no stack** and never terminates — looks like a hang/crash. The *same* binary on the *same* input runs clean the other ~25% of the time.

**Root cause:** high-entropy kernel ASLR (`vm.mmap_rnd_bits`, common on newer kernels/containers) is incompatible with ASan's shadow-memory mapping — ASan's SEGV handler re-faults in a loop. This is an **environment issue, NOT a bug in the program under test.** It masqueraded as "my fix is nondeterministically broken" and cost ~30 min of false investigation.

**Fix:** run the ASan binary under `setarch "$(uname -m)" -R <cmd>` (sets `ADDR_NO_RANDOMIZE` personality; **no root needed**). Then ASan behaves deterministically — real `heap-use-after-free` reports when the bug fires, clean exit otherwise. (`sysctl -w vm.mmap_rnd_bits=28` also works but needs root.)

**Also:** set `ASAN_OPTIONS=detect_leaks=0:abort_on_error=1:disable_coredump=1` — gcc-ASan core dumps are enormous (multi-GB) and make each abort take minutes; `disable_coredump=1` keeps aborts fast. And single ASan `spirv-opt` runs are actually <1s — apparent "hangs" were concurrent-load contention from multiple ASan processes + builds running at once.

**Context:** discovered while fixing the SPIRV-Tools `MergeReturnPass`/`DefUseManager` use-after-free (shader-slang/slang#13230, KhronosGroup/SPIRV-Tools#6711).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790190755068-gcc-asan-spirv-opt-deadlysignal-loop-is-a-kernel-a.md`_
