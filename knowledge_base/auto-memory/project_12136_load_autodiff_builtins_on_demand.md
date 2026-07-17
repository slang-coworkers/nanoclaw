---
name: project_12136_load_autodiff_builtins_on_demand
description: "#12136 load autodiff builtins on demand — BLOCK (verified 🔴 lazy-load SIGSEGV), supersedes ABSTAIN"
metadata:
  node_type: memory
  type: project
  originSessionId: 9e00866d-1161-40f3-983f-d565d8f96442
---

# #12136 "Load autodiff builtins on demand" (jvepsalainen-nv) — BLOCK (superseded ABSTAIN)

**FINAL approver verdict 2026-07-16: BLOCK** (reason_code `RED_BUG:autodiff-lazy-load-crash-on-IDifferentiable-constraint`) @ head `ecd203861178867833f75a317a234196d9117447`, mode **live_late**, shadow (ledger row `ecd203861178` updated in place, NOT posted to GitHub). **Supersedes** the earlier fallback-tier ABSTAIN_POLICY on the same commit. Routed pr_ready_for_review → slang-pr-approver only.

**Why it flipped ABSTAIN → BLOCK:** First pass, the production claude-code-action (github-actions[bot]) primary review was still IN_PROGRESS through the WAIT window → approver fell back to CodeRabbit+Devin and ABSTAINed on an unverified 🔴. The primary review then **landed** at the same head: verdict 🟡 "0 bugs / 8 gaps", but its MAIN concern (gap #1) = the two lazy-load triggers miss paths needing supplement-only decls. Approver's challenger escalated gap #1 to a **VERIFIED 🔴 SIGSEGV**.

**The real bug (verified in CI, not the null-deref):** `IDifferentiable`/`IFloat` used only as a **generic constraint** (or merely reflected) fires **neither** load trigger — triggers are (a) a `[Differentiable]` callable, (b) fwd_diff/bwd_diff/primal-substitute expr. So the autodiff supplement never loads and downstream machinery that assumes its shape crashes. SIGSEGV at `tools/slang-unit-test/unit-test-function-reflection.cpp:383` (`module->getLayout()->findTypeByName("MyStruct<float>")`). Confirmed in **CI job 87553860992** — **8 test-slang jobs RED across all platforms**, deterministic (not flake/infra). PR-causality airtight: both crashing tests (unit-test-function-reflection.cpp, assoctype-param.slang) are pre-existing and unmodified by the PR.

**Next-action (maintainer/author):** widen the load-trigger set so the supplement also loads when `IDifferentiable`/`IFloat` appear as a generic constraint, or when reflecting/checking such a type. (Reviewer gap #1 also suggests option (b): keep the pure tensor/torch value types + `Array`/`Optional`/`Tuple : IDifferentiable` extensions in base core, deferring only the diff machinery.)

**The 7 other gaps are advisory** (clarity/API/doc/test-coverage), INCLUDING the earlier CodeRabbit 🔴 null-deref at slang-check-decl.cpp:19216/:19215 — the primary review classifies it as a **missing regression test, not a crash**. Author had defended the RELEASE_ASSERT + no-null-guard on-PR (out-of-contract invariant; addMember ownership required); that stands as advisory.

**Note:** `ci_green_on_sha` clause PASSED only because policy `require_ci_green=false`; actual CI is RED — challenger caught it (same class as #12130/#12122). Awaiting human verdict for the join. See [[feedback_approver_never_posts_route_reviewer]].
