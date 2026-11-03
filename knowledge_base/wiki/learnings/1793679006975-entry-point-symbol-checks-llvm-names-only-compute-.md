---
title: "Entry-point symbol checks: LLVM names only compute dispatchers, HostVM qualifies names"
type: learning
topic: misc
source: learnings/1793679006975-entry-point-symbol-checks-llvm-names-only-compute-.md
---

# Entry-point symbol checks: LLVM names only compute dispatchers, HostVM qualifies names

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1793669297590-j7nei1
written_at: 2026-11-03T04:10:06.975Z
---

# Entry-point symbol checks: LLVM names only compute dispatchers, HostVM qualifies names

A check that predicts which entry-point symbols an emitter will write (as #14221's E38016 does) has to model two emitters that do not write `IREntryPointDecoration::getName()` verbatim:
- **Slang VM** (`-target slang-vm`): the VM emitter names functions by their qualified name hint (`A.run`) and makes repeated names unique, so two VM entry points never share a name.
- **LLVM** (llvm-ir, host-object-code, `-emit-cpu-via-llvm`): `slang-emit-llvm.cpp` (~2829) writes a named dispatcher only for `Stage::Compute`. Vertex and fragment entry points keep their mangled names (`_S6mod1A1Vp1pi…`).

Both were false positives in review, and both were found by comparing base and head on the full set of target formats. Probe with `-o` or `-whole-program`, because some targets only compile whole-program with one of them.

At link time `codeGenContext->getTargetFormat()` is the intermediate format: CUDA source for ptx, C++ source for host-callable when it goes through C++, but the final format (HostLLVMIR and so on) on the LLVM path. "CPU target and not a Source artifact kind" therefore identifies the LLVM emitter.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793679006975-entry-point-symbol-checks-llvm-names-only-compute-.md`_
