---
name: project_9580_glsl_legalize_layout_mismatch
metadata: 
  node_type: memory
  type: project
  originSessionId: ae284e48-0735-45e1-95e5-8a218979832f
---

#9580 — GLSL varying legalization crash. Maintainer jkwak-work (assignee) asked bot to triage + check repro on 07-09.

**Triager verified (empirical, 3-way):** still reproduces at ToT `d8e8e1a9e` — VARIANT 0 (assoc-type-of-`export`-struct entry-point return) → `SLANG_ASSERT slang-ir-glsl-legalize.cpp(2166): structTypeLayout` (Debug) / segfault in `createGLSLGlobalVaryingsImpl` (Release). Mechanism = type⇄layout mismatch: post-link return type resolves to concrete `%ColorOutput` but **entry-point result layout never refreshed after link-time specialization** → concrete struct paired with stale opaque assoc-type layout → null structTypeLayout. VARIANT 1 (direct-extern) works because `lookupExternDeclRefType` refresh fires there.

**Bisected to PR #8603** (symbol-alias link-time types). Contributor already prototyped principled **producer-side** fix on branch `fix/link-time-entrypoint-layout` (+5 unit tests) and offered to PR.

**Proposed PR:** #10030 (draft, h3r2tic) **= the `fix/link-time-entrypoint-layout` contributor branch** originally flagged. On 07-09 jkwak-work asked bot to read two PR #10030 comments — [review 3982976240](https://github.com/shader-slang/slang/pull/10030#pullrequestreview-3982976240) + [comment 4452316797](https://github.com/shader-slang/slang/pull/10030#issuecomment-4452316797) — and **propose a solution conforming to the review feedback**.

**⚠️ CORRECTION (reverses earlier "adopt the branch"):** PR #10030's approach was **rejected**. tangent-vector (CHANGES_REQUESTED): PR is "wrong by construction" — adds new layout logic at **IR/back-end** level, but core layout is **AST/front-end** level. Fix must make front-end layout/binding logic account for link-time specialization (so reflection is correct too), not kludge in the back end. csyonghe concurs: "a front-end resolution step before generating the entrypoint layouts."

**Exact site (triager-traced):** `slang-parameter-binding.cpp:2739-2749` already resolves a *directly*-extern result type via `lookupExternDeclRefType` (why VARIANT 1 works). Gap: an *associated type of* an export struct (VARIANT 0) isn't resolved through the export's link-time binding there. Conforming fix = front-end resolution of that case.

**State:** OPEN. `reproduced` label applied (human-set regression/Dev-Reviewed/Type=Bug untouched). Verdict posted [comment 4920403540](https://github.com/shader-slang/slang/issues/9580#issuecomment-4920403540). Triager re-dispatched to slang-fixer to propose the **conforming front-end fix** (verify against repro, may post verified non-committal design-proposal comment to unblock jkwak). Final approach/merge is jkwak-work's call (assignee). Drafts-only + ready-flip/merge/close gated; won't edit/close the contributor's PR. Triager owns the fixer edge — do NOT double-dispatch. Canonical thread `gh-issue-shader-slang/slang-9580`. Awaiting fixer's proposal → triager forwards up.
