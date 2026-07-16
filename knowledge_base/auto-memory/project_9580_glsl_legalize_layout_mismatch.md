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

**07-09 maintainer green-light + clarity ask** ([comment 4940132728](https://github.com/shader-slang/slang/issues/9580#issuecomment-4940132728)): jkwak — *"Let's go with what you recommended; but I am not sure what you are suggesting exactly. I will keep it in mind when I review the PR once available."* = (1) DESIGN GREEN-LIGHT on the front-end fix, (2) proposal wasn't concrete enough — wants clearer restatement, (3) expects a DRAFT PR he'll review/merge himself. Not a park; fixer may build the front-end fix as a DRAFT PR. Ready-flip/merge stays jkwak's (his own words).

**07-10/11 fixer posted clarification** (with sibling approaches + a `makeStruct` angle — details in fixer's #9580 clarification comment; Main did not fabricate these terms).

**07-11 maintainer decision** ([comment 4975514968](https://github.com/shader-slang/slang/issues/9580#issuecomment-4975514968)): jkwak — *"Let's go with the sibling approach. Let's create a new issue about makeStruct; and assign it to me."* Two directives: (1) proceed with the **sibling approach** for the #9580 fix, (2) **file a NEW issue about `makeStruct`, assign to jkwak-work**. Forwarded verbatim through triager → fixer (fixer holds the sibling-approach/makeStruct context from its clarification comment).

**Fixer's concrete interpretation (triager-confirmed 07-15):**
- **Sibling approach** = new helper `resolveLinkTimeAssociatedType` called *before* the two `lookupExternDeclRefType` call sites (slang-parameter-binding.cpp:2739-2749) — NOT extending in place — keeping the working direct-extern (VARIANT 1) path untouched. Witness-sourcing subtlety to be called out for jkwak's review.
- **makeStruct issue** = split the empty-`IRMakeStruct` hunk (`slang-ir-typeflow-specialize.cpp`) into its own issue assigned to jkwak-work, cross-linked to #9580 + referencing #10030, kept OUT of the #9580 PR.

**State:** OPEN. `reproduced` label applied (human-set regression/Dev-Reviewed/Type=Bug untouched). Verdict posted [comment 4920403540](https://github.com/shader-slang/slang/issues/9580#issuecomment-4920403540). Fixer to: (a) implement sibling approach as DRAFT PR (verified vs repro + regression test, `Fixes #9580`, `report_pr_created`), (b) create the new `makeStruct` issue assigned to jkwak-work. Final approach/merge is jkwak-work's call (assignee). Drafts-only + ready-flip/merge/close gated; won't edit/close contributor's PR #10030; new-issue creation is maintainer-directed (posts freely). Triager owns the fixer edge — do NOT double-dispatch. Canonical thread `gh-issue-shader-slang/slang-9580`. Awaiting fixer's draft PR # + new makeStruct issue # → triager forwards up.

**07-16 jkwak nudge** ([comment 4986921336](https://github.com/shader-slang/slang/issues/9580#issuecomment-4986921336)): *"can you review my previous comment?"* pointing back at his 4975514968 decision. Read as: ~5 days silence on the issue, wants bot to CONFIRM its understanding of the sibling-approach + makeStruct directive AND give status. As of triager 07-15, fixer had NOT yet reported draft PR # or makeStruct issue #. Routed through triager → chase fixer status + post GitHub confirmation/status for jkwak (closest-to-the-state). Do NOT fabricate PR/issue existence.

**07-16 fixer-reachability blocker — RESOLVED (transient, NOT auth outage).** Triager reported slang-fixer "not addressable via SendMessage." Main diagnosed: (a) triager→fixer destination edge INTACT (row present → ag-1780667166439-vmjrwe); (b) fixer group HEALTHY — many active/running sessions, newest ~1 min old, working other chains (11083/12122/9153/12046). NOT the 07-14 [[project_slang_fixer_auth_outage]] pattern (no "Not logged in"). Transient in-container SendMessage glitch; triager's message-block fallback delivered (fixer posted a compaction notice = session active). No re-spawn/re-wire/operator-escalation needed. **Triager status/GitHub reply posted** [comment 4986948079](https://github.com/shader-slang/slang/issues/9580#issuecomment-4986948079): honestly states neither deliverable landed yet (no #9580 draft PR — only rejected #10030; no fix/issue-9580 branch; no makeStruct issue). Awaiting fixer's real deliverables: sibling-approach draft PR # + makeStruct issue #.
