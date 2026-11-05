---
type: chain
title: slang#14277 — GLSL `layout(local_size_x_id = A, local_size_y_id = B) in;` with no matching `constant_id` → E99997 ICE (assert slang-check-modifier.cpp:2317)
description: Bot-filed 11-03 ~23:26Z by the #14256 fixer (side-find), no labels. OWNED by the #14256 chain (Main sess-1793741122789-jlmg2z) — its issue_opened webhook needs NO dispatch. FIXER DISPATCHED 11-03 ~23:30Z on gh-issue-shader-slang/slang-14277.
tags: [glsl, spec-constant, compute, ice, bot-filed, side-find]
---

# slang#14277 — two undeclared `local_size_*_id` hit an ICE

**Filed 11-03 ~23:26Z** by the #14256 fixer (`sess-1793741467434-vj18mh`) at my request ([#14256](14256-glsl-local-size-lost-non-shader-entry-point.md)).
No labels, no assignee. Body says "Related: #14256".

**Bug (fixer, reproduced on master `e73d26897`).** `layout(local_size_x_id = 5, local_size_y_id = 6, local_size_z = 2) in;` with no
`[vk::constant_id]` declarations: `slangc -stage compute -entry main -target spirv-asm` → E99997 `assert failure:
slang-check-modifier.cpp(2317): constantId->args.getCount() == 1`. As controls, one undeclared id and two declared ids both compile.
The fixer's guess, from code reading: the first axis creates a spec-constant `VarDecl` whose `VkConstantIdAttribute` has no `args`
(`:2330-2341`), and the second axis's lookup (`:2312`) finds it. Dedup was clean (closed #5948 is a different bug).

**Disposition (Orchestrator, 11-03).** **The `issue_opened` webhook (Main session `sess-1793748404156-kpvh60`) needs no dispatch**;
this chain owns it. I rated it medium: an ICE on valid GLSL with a crisp repro and a likely-small fix at the producer. So the fixer
goes on it even though 6 fixer sessions are running. slang-fixer is dispatched on `gh-issue-shader-slang/slang-14277`; session `sess-1793748506323-cy5uzn`, verified on-thread 23:28Z (sent with `in_reply_to=2` so it did not land in the #14256 session).

**Resume on:** the fixer's `[Report]`; a review or comment on its PR; a human comment on #14277.

**11-03 — `issue_opened` webhook received and closed with no dispatch.** The fixer session `sess-1793748506323-cy5uzn` is active/running on the canonical thread (checked with `ncl sessions get`).

**11-04 01:06Z — DRAFT PR #14284** (`fix/issue-14277`, head `e27ccc4`). It has 4 commits: tests → producer fix → finding a `constant_id` declared after the layout →
implicit default of 1. Targeted dirs pass 1136/1136, and the GLSL/reproduced labels were added. The fixer sent its explain-diff HTML
(`/workspace/inbox/a2a-1793754375235-5sul2x/`). **Ready-flip pending** (weekly list). Waiting for the [Report]. When it comes, check that commits 3–4 are justified (scope).

**11-04 01:09Z fixer `[Report]`.** Fixed at the producer: the implicit `VkConstantIdAttribute` now carries its id expression, and the assert is unchanged.
- Cascade fixes, which I judged in scope:
  - The implicit constants are named `$local_size_id_<id>` so the linker doesn't merge them.
  - They default to 1, not `OpSpecConstant 0`.
  - A `constant_id` declared after the layout is found by modifier-checking siblings first.
- Tests: 9 filecheck variants plus VK direct and via-GLSL runs on the L40S. Full suite 11444/11447; the 3 CUDA fp8 PTX-JIT failures are unrelated.
- CI run 41750622512; slang-reviewer review in flight.
- Observation (b), pre-existing: a declared `constant_id` axis defaults to the constant's initializer, while glslang uses local_size or 1, so the direct-SPIR-V and
  via-GLSL defaults differ. **I told the fixer to file it only with a spec citation and a side-by-side repro (filed-only, no fixer chain); if the spec is ambiguous, a note
  in the #14284 explanation comment instead.**

**Resume on:** reviewer verdict / `[Fix Report]`; any follow-up issue number for (b); a review or comment on #14284.
**11-04 01:14Z** — (b) was **not filed**. GL_KHR_vulkan_glsl is silent on a `constant_id` that shares an id with a `local_size_*_id`: it says the ids are "declared independently",
and Issue 6 rejects sizing the workgroup through `constant_id`. So it is a design question; one sentence was added to the #14284 explanation comment
6619690218. R1 review verdict ETA ~90 min.
**11-04 02:34Z** — #14284 review round 2, head `f6b3617`; the R2 explain-diff HTML is at `/workspace/inbox/a2a-1793759692296-f6j4fh/`. Waiting for the `[Fix Report]`.
**11-04 02:35Z fixer `[Report]`.** R1 was REQUEST_CHANGES (small); 5 commits pushed, head `f6b3617`, R2 requested.
- B1: an invalid `constant_id` after the layout crashed. A GLSL layout attribute that fails to check is now dropped, which also fixes the master segfault when the constant_id comes before the layout.
- B2: the default is the sibling `local_size_<axis>`, else 1 (matches glslang).
- Codex found that the B2 change broke a spec-constant `local_size_x = SPEC_SIZE`; fixed, with a test.
- Tests: full suite 11449/11452 (fp8 only).
- **Reviewer side-finds (pre-existing on master; my routing):**
  - **S1** (`slang-emit-glsl.cpp:1551-1560` writes `local_size_x_id` with no default, so via-GLSL runs 1×2 while `gl_WorkGroupSize.x` reads 4): this one is a verified bug, unlike (b),
    because the program contradicts itself within one compile.
  - **S2** (`slang-parser.cpp:10820`: one `layout(...)` keeps only the last `local_size_x`/`_id` per axis).
  - I told the fixer to reproduce S1 and S2 on master and file them as 2 separate **filed-only** issues (no fixer chains yet), not through a triager.
  - **S3:** fixed by B1, so no issue.

**Resume on:** the S1/S2 issue numbers; R2 verdict / `[Fix Report]`.
**11-04 02:47Z — side-finds FILED (filed-only, owned by this chain; their `issue_opened` webhooks need NO dispatch):**
- **#14288** (S1): GLSL emit writes `local_size_x_id` without the axis default (`slang-emit-glsl.cpp:1554-1563`). On the L40S, direct SPIR-V reads `4 2 8` and via-GLSL reads `4 2 2`.
- **#14289** (S2): one `layout(...)` keeps only the last `local_size_x`/`_id` per axis (`slang-parser.cpp:10819`). glslang gives SpecId 3 / default 8.
- Both have the `GLSL` + `reproduced` labels and "Related: #14277". No fixer chains yet; that is my call later.
- Noted only, not filed: `-pass-through glslang` aborts with E99997 on these GLSL files (it was not minimized or deduped).
- **11-04 — #14289 `issue_opened` webhook received, closed with no dispatch** (filed-only, this chain owns it).
**11-04 — #14288 `issue_opened` webhook received and closed with no dispatch** (filed-only side-find S1, owned here; body matches the record). The fixer-chain decision for #14288/#14289 is still open.
**11-04 03:40Z** — #14284 after R2, head `0945b18`; the explain-diff HTML is at `/workspace/inbox/a2a-1793763615344-knj87a/`. Waiting for the `[Fix Report]`.
**11-04 03:40Z fixer `[Fix Report]`. Chain terminal, held for a maintainer.** #14284 draft at head `0945b18` (+344/−3, 5 files).
- R1 REQUEST_CHANGES → applied; R2 REQUEST_CHANGES (small: B3 use-after-free, G2 spurious E20016 for `atomic_uint`, G3 size error reported twice) → the reviewer's tested patch was applied, with no further round.
- Tests: PR tests 19/19; full suite 11452/11455 (fp8 only).
- Left for the maintainer: N4 (an HLSL warning shows the internal `$local_size_id_<id>` name); whether that name is API; comparing `location` instead of re-folding `args[0]`.
- CI run 41767473258. **Ready-flip pending** (weekly list). Side-finds #14288/#14289 filed-only.

**Resume on:** a maintainer review or comment on #14284 (the webhook routes it to the fixer); CI red; a human comment on #14277/#14288/#14289.
