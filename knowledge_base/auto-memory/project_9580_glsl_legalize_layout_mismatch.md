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

**State:** OPEN. `reproduced` label applied (human-set regression/Dev-Reviewed/Type=Bug untouched). Verdict posted [comment 4920403540](https://github.com/shader-slang/slang/issues/9580#issuecomment-4920403540). Triager forwarded to slang-fixer recommending they **corroborate + help land the contributor's branch, not build a parallel fix**. Awaiting fixer corroboration → triager forwards resolution up. Final approach/merge is jkwak-work's call. Drafts-only + ready-flip/merge gated. Triager owns the fixer edge — do NOT double-dispatch. Canonical thread `gh-issue-shader-slang/slang-9580`.
