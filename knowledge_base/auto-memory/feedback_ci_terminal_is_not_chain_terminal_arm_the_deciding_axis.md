---
name: ci-terminal-is-not-chain-terminal-arm-the-deciding-axis
description: "Three parties armed watchers on the CI run and nothing on the PR's review state, so the maintainer approval that actually resolved the chain arrived unobserved — arm the axis the DECISION arrives on, not the one you were last debugging."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3a9c1658-b084-4fd9-badf-659d94e701b9
---

**2026-08-05, slang PR #12353.** Timeline of a chain resolving while three agents watched the wrong thing:

```
22:40  CI run reaches terminal (34/37)          <- all three watchers armed here
22:46  jkwak-work APPROVES + resolves the scope question   <- NOBODY armed here
22:50  slang-fixer compacts (approval outside its context)
22:54  my summary still says "closed on all three sides"
22:56  caught only because a peer re-verified live PR state before briefing the fixer
```

⭐⭐⭐ **CI TERMINAL IS NOT CHAIN TERMINAL.** I held a correct, bound-checked, fully-verified terminal CI measurement and wrote *"closed on all three sides"* — substituting *the axis I had been debugging for hours* for *the axis the decision actually arrives on*. The chain was never gated on CI; it was gated on a maintainer's review. **A measurement can be flawless and still answer a question nobody asked.**

⇒ **Before declaring any chain done, ask: what EVENT would resolve this, and is anything armed on THAT?** Watchers accrete around whatever you last debugged (here: a runner outage → a CI-run trigger), so the instrumented axis drifts away from the deciding axis precisely as the chain matures.

⭐⭐ **The catch came from re-verifying live state instead of restating a summary** — one `gh pr view`. The peer's trigger was *"a counterparty just announced a compaction"*, which is a good heuristic: **a peer's context loss is a cue to re-measure, not to re-send what you already believe.**

⭐⭐ **A MAINTAINER'S FRAMING GETS LESS SCRUTINY THAN A PEER'S — which is exactly why it needs the same check.** jkwak-work's *"all other sibling functions whose return type is `SlangResult`"* is **base-class framing** that provably cannot reach `LLVMDownstreamCompiler::validate` — verified `slang-llvm.cpp:116`: `class LLVMDownstreamCompiler : public ComBaseObject, public IDownstreamCompiler`, bypassing `DownstreamCompilerBase`, own `validate` at `:139` returning bare `SLANG_FAIL`. That is the **R2 enumeration defect recurring in the maintainer's own words** (all four of us had already missed LLVM once by enumerating subclasses instead of implementors). Authority substitutes for verification silently.

⛔ **`BEHIND` on an APPROVED head is the maintainer's to resolve — never force-push it.** The approval attaches to a specific SHA; rebasing over it **can dismiss the approval** and destroy what three review rounds produced. It renders as a fixable-looking warning, which is the trap — the same shape as [[feedback_drafts_only_guardrail]]: a state the maintainer set, that only the maintainer should change.

⚠️ **A "cheap fix" that satisfies the stated finding can CONSUME the issue.** #12355 must stay out of the sanctioned sweep: `SLANG_FAILED(0)` is `0 < 0` = **false** and `SLANG_OK` is `0`, so swapping `!= SLANG_OK` → `SLANG_FAILED` at `slang-emit.cpp:3419` is a **byte-identical no-op** — tidying it as "fixing result codes" lands a green diff, closes the issue, and leaves the null deref. An automated router already tried to dispatch exactly that edit. **Order: (b) the deref first** (no result code of any spelling can express "succeeded but wrote nothing"), **(a) the idiom second with the no-op stated.**

See [[feedback_a_watcher_scoped_to_the_known_hazard_reports_silence_as_all_clear]] (wrong trigger *within* an axis — this file is the wrong *axis*), [[feedback_a_valid_control_compatible_with_both_hypotheses_settles_nothing]], and [[project_12342_downstream_absent_capability_slangresult]].
