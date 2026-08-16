---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786813671037-9yan2p
written_at: 2026-08-15T18:11:48.989Z
---

# [shader]+export imported entry point with params hangs whole-program codegen (slang#12564)

shader-slang/slang#12564: slangc NON-TERMINATES (reporter saw a segfault on v2026.14.1; at HEAD it's a 100%-CPU hang) when a PRECOMPILED `.slang-module` function marked BOTH `[shader(...)]` AND `export` AND having >=1 PARAMETER is IMPORTED into another module and re-emitted to any target. Verified @ master HEAD 37f3a4f47.

TRIGGER ISOLATION (retained 9-cell matrix, each cell its own src + fresh .slang-module rebuild): HANG iff ([shader] AND export AND >=1 param). Controls that do NOT hang: [shader] alone, export alone, zero-param [shader]+export (E57004 no exported symbols). NOT the trailing comma; the extra cross-module dep is not required BUT the import-of-the-precompiled-module IS (source-only import => no hang; compiling the module directly => no hang). Hangs on spirv/cuda/cpp/torch alike (target-independent).
- ⭐The "varying parameter" framing is a CONFOUND: a UNIFORM param and a plain no-semantic param both hang; SV_Position-return-with-ZERO-params does not. It's parameter COUNT>=1, not varying-ness or the return semantic. Run a same-count non-varying control before claiming "varying is load-bearing."

ROOT CAUSE (hedged): backtrace bottoms out in linkAndOptimizeIR with innermost frames ONLY IRInstListBase::Iterator ++/!= ; flat stack + flat RSS => a non-terminating IR sibling-list traversal (not recursion, not list growth). Do NOT over-claim: (a) IRInstListBase::Iterator is SHARED across decorations/children/blocks/module-globals, so the stack does NOT prove a getGlobalInsts walk; (b) NULL-terminated iterator => the flat-loop signature fits a cyclic list OR a live-list-reorder churn OR a fixpoint re-processing the same set — cyclic is suspected not proven; (c) the "cloned twice via naive insert" theory is FALSE — moveToEnd()/insertAtEnd()/_insertAt() already remove-before-insert (slang-ir.cpp ~9216/9259/9266) and the reuse guard is in cloneGlobalValueWithLinkage not cloneGlobalValueImpl; (d) unexportNonEmbeddableIR SPIRV arm is not the producer (all-targets hang). First-broken-invariant pass NOT localized — could be the linker OR a later target-independent pass after linkIR() returns.

DEDUP: NOT #8955/PR#8997 (that fix f8e97d9bd is already in HEAD and this still reproduces; #8955 = GLSL varying-legalization SEGFAULT compiled directly from own serialized module — distinct symptom+pass). Adjacent family (serialized-module vertex/entry-point). Open maintainer question: should [shader]+export on one function be legal at all, or diagnosed at the front end?

INSTRUMENT GOTCHAS (this session): (1) A SIGPROF sampler that calls backtrace_symbols_fd (malloc) ABORTS the target with a glibc malloc-assertion when it interrupts malloc — use raw-PC capture in the handler + offline addr2line against /proc/<pid>/maps base. (2) -dump-ir / -dump-ir-before/after emit 0 lines on a hang (buffered diagnostic sink never flushes) — 0-lines is NOT a pass boundary. (3) `slangc -v` prints a stale configure-time string (2026.13.1-50-g...) — prove freshness behaviorally (e.g. semicolon-less `throw` is rejected = post-#12328). (4) A stale prebuilt binary may not reproduce a fresh-HEAD bug — the Aug-13 Release binary here did NOT hang; a fresh HEAD build did. Always reproduce on a fresh build.
