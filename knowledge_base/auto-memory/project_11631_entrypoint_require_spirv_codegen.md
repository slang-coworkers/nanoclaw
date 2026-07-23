---
name: 11631-entry-point-require-spir-v-codegen-caps
description: "shader-slang/slang#11631 — entry-point [require] doesn't update SPIR-V codegen caps; long maintainer design saga → csyonghe resolution; draft PR"
metadata: 
  node_type: memory
  type: project
  originSessionId: 01981e60-dc59-4b11-95f3-bc73ad5021b7
---

**shader-slang/slang#11631** (reporter pdeayton-nv): entry-point `[require(...)]` capabilities are validated but never merged into the SPIR-V codegen capability set (`getTargetCaps()` = target format + `-profile` + `-capability` only), so source-level `[require]` diverges from command-line `-capability`. Two repros: (1) `[require(spvBindlessTextureNV)]` emits descriptor-heap path not BindlessTextureNV; (2) `[require(spirv_1_5)]` stays SPIR-V 1.0. Verified compile-only.

**Draft PR #11633** (`fix/issue-11631`, branch author nv-slang-bot[bot]) — started as the version-half fix (stamp require atom on codegen module + `determineSpirvVersion` unify). Kept DRAFT throughout.

**Maintainer design saga (all public on the issue):**
- jkwak-work first approved the version PR, then (with csyonghe) ruled `[require]` is **validation-only**, NOT a `-capability` replacement — capability must be a global per-compilation setting (multi-entry consistency). That direction → close #11633 as by-design.
- pdeayton-nv (reporter) pushed a diagnostic scheme (E41012 un-suppress + new error for unsatisfiable `[require]`).
- **tangent-vector** (capability-system architect) then read the **original issue as VALID**: his "compromise flow" step 2 says codegen SHOULD inflate caps to include the entry point's requirements; opposes a distinct `[require]`-specific diagnostic (wants explicit-OR-inferred treated **uniformly**). Contradicted jkwak's validation-only stance at the codegen layer.
- **csyonghe** (the authority both deferred to) RESOLVED it (~07-09, cmt 4928176359): encode user-specified caps as decoration on each entry point; **SPIR-V backend passes scan all entry points & honor them alongside global options; legalize bindless accordingly; conflicts (cross-entry OR source-vs-`-capability`) → error.** Sides with tangent-vector (codegen honors `[require]`), reverses jkwak, and answers jkwak's consistency concern via conflict→error.

**OPEN residual divergence (surfaced, NOT resolved):** csyonghe scopes to **user-specified (explicit `[require]`) only**; tangent-vector wanted **uniform explicit-OR-inferred**. Fixer found explicit-only is BETTER — it avoids the E50011 CI-red that stalled #11633 (ray-tracing test `explicit-shader-stage-7.slang` has zero `[require]`; body-inferred version → explicit-only stamps nothing → codegen unchanged → E50011 green).

**Current state (2026-07-23):** pdeayton-nv @-mentioned the bot: "go ahead with expanding draft 11633." jkwak/tangent-vector silent ~2 weeks since csyonghe's resolution. **Main GREEN-LIT implementation on DRAFT #11633**, scoped to csyonghe's explicit-only design (authority spec + fixer rec + avoids CI-red). Basis = csyonghe authority resolution + reporter go-ahead + maintainer silence — NOT a claim jkwak/tangent-vector concurred. Fixer to: expand #11633 (reuse step-1 plumbing), add bindless + conflict-error halves, full-suite verify, and PR must flag the explicit-only-vs-uniform scoping question inviting jkwak/tangent-vector against the concrete diff.
**Gates:** code pushes to draft NOT gated ([[feedback_pushes_not_gated]]); ready-flip + merge operator-gated ([[feedback_github_writes_operator_authorized]]); do NOT auto-close the issue — post `[Resolution]`, leave close to maintainers. slang-fixer owns the live technical thread; slang-triager echo-reports (redundant, harmless).
