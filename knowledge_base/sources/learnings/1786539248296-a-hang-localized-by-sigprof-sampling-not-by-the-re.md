---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786526532573-utvvl3
written_at: 2026-08-12T12:54:08.296Z
---

# A hang localized by SIGPROF sampling, not by the reporter's found-inst lead (slang#12498)

**Context:** shader-slang/slang#12498 — `slangc -target spirv-asm` hung forever for a helper returning `Optional<Node*>` that can `return none`. Reporter's lead: found while probing `emitCastPtrToBool` (slang-emit-spirv.cpp:9554), the SPIR-V lowering of the `CastPtrToBool` inst produced by slang-ir-lower-optional-type.cpp:226.

**The lead was a RED HERRING.** `emitCastPtrToBool` is where the reporter *found* the `CastPtrToBool` inst while browsing coverage — not where the process loops. The actual infinite loop was in a totally different pass: `AddressSpaceContext::processModule()` (slang-ir-specialize-address-space.cpp:375), the SPIR-V/Metal address-space specialization worklist fixpoint. `HashSet<IRFunc*> newWorkList;` was declared OUTSIDE the `while (workList.getCount())` loop and never cleared, so once any callee's result address space became concrete (happens exactly when a pointer/address-taken value is *returned* = the reporter's "function boundary" clue), `workList` was refilled from the whole accumulated set every round forever. One-line fix: move the declaration inside the loop.

**LESSON 1 — for a HANG, localize by SAMPLING, not by reading the reporter's found-inst.** No gdb/lldb present. Built a tiny LD_PRELOAD SIGPROF sampler (`backtrace()`+`write(fd3)`, `setitimer(ITIMER_PROF)`, maps dumped at startup in a `__attribute__((constructor))` — NOT in the signal handler, `fopen` isn't async-signal-safe), ran the hang ~8s, resolved addresses with `addr2line -e libslang-compiler.so <offset>` (offset = runtime addr − load base from /proc/self/maps). 156/159 samples landed in `processModule`/`processFunction`, ZERO in emit → the reporter's lead was disproven in one measurement. A "where I found the inst" pointer answers a different question than "where does it loop"; treat it as a lead, verify by sampling.

**LESSON 2 — the DECISIVE control was BROADER than the report's isolation.** The reporter had already isolated to "the none-returning helper". But a plain `Node*`-returning helper (NO Optional, NO none, NO CastPtrToBool) ALSO hangs. That single control proved the root cause is the address-space fixpoint (any returned pointer triggers it), not anything Optional-specific — and killed the CastPtrToBool hypothesis independently of the profile. When a report isolates to feature X, try the same shape WITHOUT X: if it still fails, X is a symptom, not the cause.

**LESSON 3 — DeepWiki confirmed the INTENDED design, which named exactly what the bug defeats.** DeepWiki: the fixpoint is designed to converge *because* a function's result address space is monotonic (Generic→concrete, at most once). The un-cleared round-set defeats precisely that termination guarantee. Asking "how is this loop *supposed* to terminate?" turns a vague "infinite loop" into a specific "the thing that guarantees termination is being bypassed here".

**Not a regression:** buggy loop dates to #4137 (2024-05, 168 tags). Long-latent, surfaced by agentic test-gen.
