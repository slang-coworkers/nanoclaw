---
name: project_12400_wgsl_out_param_ptr_function
description: "#12400 WGSL out-param emitted as ptr<function> — Tess (tangent-vector) gave the authoritative root 2026-09-02: stage+boundary policy. Two defects: (1) fragment out + user-defined semantic must DIAGNOSE; (2) vertex out : TEXCOORD0 is valid input, WGSL ptr<function> is a real lowering bug. Sibling (not same root) of #8183; dedup candidate #7176."
metadata:
  node_type: memory
  type: project
  originSessionId: 35469e7f-5e4c-4768-9736-7c4a31447a3b
---

# shader-slang/slang#12400 — WGSL: `out` param emitted as `ptr<function,...>` instead of a varying output

**Filed 2026-08-06 by nv-slang-bot[bot]** — a bot-filed tracking artifact opened mid-#8183 work to stop the WGSL half being fixed twice. Canonical thread `gh-issue-shader-slang/slang-12400`. Triaged bug · medium · P2 · target-emit (WGSL) + IR entry-point varying-param legalization (verdict cmt `5207998744`).

## ✅ AUTHORITATIVE ROOT — Tess (tangent-vector) cmt `5513918318`, 2026-09-02
Entry point = decl + **stage**; entry-point semantic checks run after ordinary decl validation.
- Params are **uniform** (`uniform` modifier / always-uniform types like textures/buffers) or **varying** (all else). Return type = an implicit `out` varying param.
- A varying param may carry an explicit semantic; those without get an **auto-assigned USER-DEFINED** semantic later in compilation. A semantic is either **system-value** (`SV_`, case-insensitive) or **user-defined**.
- Each stage defines, per varying **boundary** (`in`/`out`): allowed SV semantics + types, **and whether user-defined semantics are allowed on that boundary**.
- ⭐ **THE RULE:** the `fragment` stage does **not** permit varying params with user-defined semantics on its `out` boundary. Once the stage is known, the front end consults the stage/boundary policy for a param with a user-defined (explicit or auto) or no explicit semantic, and **diagnoses an error** where that boundary disallows it.

### ⇒ Resolves the two-defect split (and the open "invalid regardless?" question → NO, it's stage/boundary-dependent)
- **Defect 1 — missing diagnostic.** Fragment `out` + user-defined semantic (explicit *or* auto-assigned). Covers the plain `out float4 extra` repros **and** #8183's nested crash (whose crashing field had no semantic ⇒ also a missing-semantic case, not semantics-independent). Remedy = front-end diagnostic (Tess's "it's a missing diagnostic"), not a lowering fix.
- **Defect 2 — genuine WGSL lowering bug.** **Vertex** `out float3 : TEXCOORD0`: vertex `out` *permits* user-defined semantics (interpolant mechanism) ⇒ valid input, yet WGSL emits `ptr<function>` (metal/spirv/glsl/hlsl all succeed). This is a real WGSL-only lowering gap the diagnostic won't touch.

**Earlier triage framing corrected:** a plain `out float4 extra` DOES flow through varying logic and gets an implicit **location** (`OpDecorate %extra Location 0` on spirv, `layout out` on glsl) but never a resolvable binding-semantic **name** (`slang-parameter-binding.cpp:2221`/`:2504`, `VarLayoutFlag::HasSemantic`). So "unsemanticed" was imprecise — Tess's implicit/auto-assigned-user-semantic framing is the accurate one.

## Pending action (Main does NOT adjudicate the compiler claim; triager owns the reply)
- ⚠️ Tess called the bot's comments "a whole lot of words without conveying much content" and demanded **CONCISE**. Reply must be a few sentences: confirm the model + measurement match, raise the single vertex-vs-fragment point, note the WGSL lowering as separate. No re-derivation of what she wrote.
- Verdict cmt `5207998744` should adopt her stage/boundary/policy vocabulary. Triager to GROUND in the policy and CONFIRM with Tess, not assert over her.

## Relationship to #8183 — SIBLING, not same root
Metal path gates `Stage::Vertex|Fragment` → `legalizeShaderOutputParamsForMetal` → `lowerOutParameters` (`slang-ir-legalize-varying-params.cpp:5090/5110/5136`). WGSL's `legalizeEntryPointVaryingParamsForWGSL` (`:5165`) never calls `lowerOutParameters`. ⇒ **Metal's failure is the stale layout left BY `lowerOutParameters`; WGSL's is the ABSENCE of that lowering.** ⭐ An absent call cannot be the same root as a faulty one — "other half of the same *asymmetry*" is right, "same *root cause*" is not.

## #12155 (the #8183 guard PR) — related, mostly superseded here
PR #12155 (`fix/issue-8183`, **our own** draft, assignee/reviewer `jkwak-work`; #8183 reassigned jkwak-work → **`zangold-nv`** 2026-08-06). Durable facts:
- ⛔ "0 reviews in N days" on a **draft** is NOT reviewer neglect — GitHub doesn't solicit review on a draft; a `review_requested` registered 13 s after creation is against the draft. `mergeable_state=blocked` on a draft ≠ merge conflict. The blocker is a **ready-flip nobody performed**, and it's ours to surface.
- Its bounds guard doesn't cover the **non-struct-return + `out` param** shape (still crashes); the layout it describes is the wrong **type**, not wrong field-count. Reviewer A found further defects in the same helper (walk divergence at `:3693` = silent wrong-`@location` miscompile; offset-kind union at `:3668`; rebuilt layout never written back). Fixer's position (accepted): NOT widening the draft — the real remedy needs `lowerOutParameters` to record layout for what it appends, landing on #10030's contested layer (zangold-nv + maintainer call).
- The full 3-cell measurement matrix and its corrections are superseded by Tess's authoritative framing; they were working-note churn against a moving PR head.

## Dedup — #7176 is an older human duplicate of the WGSL half
**#7176** (hzqst, human, filed 2025-05-20, OPEN, `WebGPU`+`Dev Reviewed`, unassigned) — `out` STRUCT param + void return still emits `ptr<function, PSInput_0>` at HEAD while metal merges correctly ⇒ cleanest demo of the asymmetry. Referenced by neither #12400 nor #8183. One of #7176/#12400 is redundant — a **maintainer dedup decision**, not prescribed. Bonus unfiled defect in #7176's WGSL: duplicate `@location(0)` (`SV_POSITION` on an out-struct field should become `@builtin(position)`).

## Durable methodology lessons (extracted to their own concepts)
- A release-compiled-out `SLANG_ASSERT` becomes `SLANG_ASSUME` in Release (`slang-common.h:371`) — an optimizer promise on a false premise, not merely absent → [[feedback_a_release_compiled_out_assert_does_not_protect_a_new_deref]].
- Ask if a review/issue defect **survives the PR that closes it** — a defect in code only the patch introduces is unreproducible on master and belongs in the PR comment, not a new issue → [[feedback_issue_or_review_comment_ask_if_the_defect_survives_the_pr_closing]].
- A `slangc` under a PR worktree's `build/` is not necessarily a build OF that PR (a fetched release tarball); check `-v`/mtime. Provenance-check an instrument before believing it. A same-error-on-control is a dead probe. → [[feedback_a_negative_on_one_shape_is_not_a_property_of_the_target]].
- ⭐ A `gh api` `updated_at` can itself be **stale**; a "not edited" claim built on it is a moment-claim, not a state-claim — re-query at point of use, and a peer's live read that contradicts mine wins until I re-verify. (An earlier "open discrepancy" that cmt 5207998744 was never edited was **RETRACTED** — the edits landed 08-13/14; my Sep-2 read was a stale/cached snapshot.)
- ⛔ Pinning a **stopped** session with a2a provider flakiness bounces repeatedly; drop the pin and let routing pick a live session on the canonical thread.

**RESUME trigger:** triager posts the concise, policy-grounded reply to Tess and adopts her vocabulary on cmt 5207998744. Then: Defect 2 (vertex WGSL lowering) becomes the actionable compiler bug; #7176 dedup disposition (maintainer); #12155 ready-flip is ours; sequence the WGSL layout-extension work with zangold-nv.

**✅ TESS DIRECTIVE — cmt `5766789741`, 2026-09-21 (three deliverables to @nv-slang-bot, routed to triager unpinned):**
1. Confirms defect 2 (vertex `out` mis-lower) is a real issue.
2. **SPLIT:** create a **new issue** for the boundary-checking *missing-diagnostic*, reproducer = **compute-shader** `out` param w/ user-defined semantic (compute has no varying outputs ⇒ cleanest boundary violation). Refocus **#12400 onto the WGSL back-end lowering** only (retitle + note the split).
3. **Root-cause ask (investigate + answer concisely on #12400):** SPIR-V/Vulkan has IR passes converting entry-point sigs to varying input/output **address spaces** — is that same pass applied for **WGSL**? If not why not; if yes why doesn't it touch this `out` param? Lead (GROUND, don't assume): `legalizeEntryPointVaryingParamsForWGSL` is an 8-line fn (only `LegalizeWGSLEntryPointContext`+`legalizeEntryPoints`, NO `lowerOutParameters` — Metal has it); `specializeAddressSpaceForWGSL` runs later at emit (#12173).
GitHub-authorized issue creation (Tess asked). NO fixer dispatch — investigation + split-tracking only; WGSL fix is future, #8183 is zangold-nv's. Conciseness still binding on Tess-facing posts. AWAIT: new issue #, refocus confirmation, root-cause answer id.
