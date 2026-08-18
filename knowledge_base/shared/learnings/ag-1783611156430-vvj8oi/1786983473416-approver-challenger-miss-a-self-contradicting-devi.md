---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786971225650-xnta6p
written_at: 2026-08-17T16:17:53.417Z
---

# [approver/challenger-miss] A self-contradicting Devin fallback 🔴 still forces ABSTAIN, not BLOCK or approval — verify by building at head

**Context.** shader-slang/slang#12503 (2026-08-17): a bot-authored `fix/issue-12493` fixer PR. Production claude-code-action review skips bot-authored fixer branches (`collect-reviews.sh` exit 20, harvest={"found":false}), so the ONLY review signal was Devin (fallback tier). Devin returned exit 0 with one 🔴 Bug: "internal helper still reachable from user code that imports the GLSL builtins → the original compiler crash can recur." Its own Analysis section, three lines up, said the opposite: "`import glsl;` → E30600 (not accessible)."

**What the change was.** Moves `__getLegalizedSPIRVGlobalParamAddr` from `core.meta.slang` (module-global, user-visible) to `glsl.meta.slang` marked `internal`, co-located with its 8 image-atomic callers. Pure visibility-NARROWING; no IR/emitter change.

**How I adjudicated the 🔴 (transferable recipe for a disputed reachability/visibility claim).**
1. Source trace: `isDeclVisibleFromScope` (slang-check-expr.cpp:1097-1103) makes an `Internal` decl visible ONLY when `getModuleDecl(declRef) == getModuleDecl(scope)`. A user's `import glsl;` keeps their code in the USER module, so a GLSL-module internal decl is filtered out; `filterLookupResultByVisibilityAndDiagnose` (:1242) then emits `DeclIsNotVisible` = E30600. No import → name never enters lookup → E30015. So `import glsl;` does NOT make an internal builtin callable — importing a module never grants access to its `internal` members.
2. Empirical: built the compiler at the PR head (full source tree; meta.slang changes need `generate_core_module_headers` + slangc + slang-test) and ran the two new diagnostic tests + a direct `import glsl;`+call probe. All produced E30600/E30015 with NO crash/abort — the intrinsic never reaches emit.

**The procedural lesson (this is the durable part).** Even with the 🔴 conclusively refuted and the fix provably clean, the decision procedure's hard rule — "investigation can only add caution, never upgrade a doc's 🔴 toward approval" — bars WOULD_APPROVE. And BLOCK requires a *verified* 🔴; recording BLOCK would assert a bug I disproved (and DECISION_REVIEW would flag the self-contradiction). The honest, in-bounds terminal state is **ABSTAIN_POLICY / CHALLENGER_CONCERN**: hand the reviewer-vs-evidence conflict to a human. Do the full verification anyway — it makes the abstain note authoritative and gives the human the answer, and it is the join signal to watch (a human approval here would confirm the fix was safe, validating the refutation).

**Recognition cue for Step 0 recall.** Devin-only fallback tier + a 🔴 that (a) contradicts Devin's own summary, or (b) claims a mechanism you can check in the checker source, is high-value to verify by build-at-head. `import <module>;` NEVER exposes that module's `internal` members — a "still reachable after import" claim about an internal builtin is refutable from isDeclVisibleFromScope alone.
