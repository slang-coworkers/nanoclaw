---
name: project_12150_include_line_cu_scoping
description: "#12150 SPIR-V DebugFunction CU-scoping for #include/__include/#line sources — follow-up part-2 of #11983/#12148; triaged bug/low/P3, fast-tracked to slang-fixer"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0f9c53c4-a055-45e3-a3de-683a689c9893
---

**shader-slang/slang#12150** — SPIR-V debug info: scope `DebugFunction` of `#include`/`__include`/`#line`-defined functions to their owning compilation unit. **bug / low / SPIR-V target-emit + IR lowering / P3.** Author nv-slang-bot[bot] — coworker-generated tracking issue (deliberately split out of PR #12148); human-verify footer.

**Origin:** the deferred half of [[project_11983_spirv_debugfunction_wrong_cu]] / draft **PR #12148**. #12148 (Approach B) scopes only *non-included module sources* (the reported `import` case); functions in `#include`/`__include`d or `#line`-remapped sources get an `IRDebugSource` but **no** `IRDebugCompilationUnit`, so `-g2` `DebugFunction` falls back to module-global scope. #12150 = resolve the owning CU for those (walk the SourceView initiating-location chain à la `_calcViewInitiatingHierarchy` in `slang-compile-request.cpp`, anchored to the current TU's source manager — `SourceFile` can be shared across modules).

**Triager finding (07-17 23:17, msg 4; confirmed on merits at master ec177850a — lower-to-ir.cpp:15443 gate, emit-spirv.cpp:10387 fallback):** Maintainer-requested (pdeayton-nv) follow-up. The include-hierarchy logic (`findIncludingNonIncludedSourceFile`) + the 5 include/multi-CU fixtures #12150 wants **ALREADY EXIST** in draft PR #12148 (head 4ccab1cc) and are **about to be STRIPPED** per the split request. So #12150 = **preserve + restore + extend-to-`#line`**, NOT from scratch. The `#line` half is genuinely new (cf merged PR #9945). **Sequencing is load-bearing** — must stack on / follow #12148, and preserve the about-to-be-stripped code/fixtures first.

**Acceptance:** (1) include-defined func scoped to includer's (non-included) CU, incl. multi-CU TUs; (2) restore the include-defined + multi-CU regression tests removed from #12148; (3) `#line`-remapped sources scoped to owning CU.

**GitHub:** verified 5-bullet triage verdict posted (issuecomment-5008429802); Issue Type set Bug. No `reproduced` (code-confirmed only). Not a duplicate.

**Routing:** triager fast-tracked to **slang-fixer** (owns #12148 context) with memo `triage-12150.md` — canonical chain orch → triage → fixer, triager owns the handoff (no Main double-dispatch). Canonical thread `gh-issue-shader-slang/slang-12150`.

**Plan accepted (07-17 23:47, triager msg 10):** fixer's **Approach A** accepted — restore the `#include` second-pass verbatim + new raw-`SourceLoc`→physical-file→CU resolution for `#line` (producer-side, TU-manager-anchored). Stale-premise urgency **resolved**: the #12148 trim was already pushed by the fixer (who owns that PR) and the removed include work is preserved in 3 places — nothing was at risk (my memo's "about to be stripped" urgency was based on the issue's "removed" tense w/o a live-diff check). **Sequencing (triager's internal branch-timing, NOT escalated to pdeayton-nv):** wait for #12148 to **merge**, branch #12150 off master. Fixer given a **conditional go** — implements once #12148 lands, no further go needed. GitHub verdict (issuecomment-5008429802) still accurate ("held pending #12148/review"), no re-post. **State: HELD on #12148 merge; fixer forwards [Fix Report] → triager forwards [Triage Resolution] upstream when draft PR lands.**
