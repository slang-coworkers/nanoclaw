---
type: chain
title: slang#13688 — Metal inline RayQuery fixed to triangle_data/instancing (no curves, no multi-level)
description: "Human-filed (albertrodriguezclo) Metal feature/design question. Triaged 10-16 08:03Z (cmt 6210949750) Feature/P3; #12691 does NOT cover inline queries. PARKED on kaizhangNV direction (tag source A/B/C, accessors i/ii); kaizhangNV assigned + Q4 2026 milestone 10-19. Reporter addendum 10-20 (cmt 6291687104, per-primitive data + intersector curve workaround) held, no bot post. Re-check t-2c3ce2 10-23 08:30Z. Sibling of #13690."
---

# slang#13688 — Metal: inline RayQuery can't traverse curves or multi-level instances

- Filed 2026-10-16 07:31:49Z by albertrodriguezclo (same reporter as #13631–#13666 and #13690).
  Asks: (1) is inline `RayQuery` on Metal in scope for #11296 / #12691; (2) choose tags from the type or
  infer them from the accessors the query calls; (3) map `intersection_type::curve` in
  `CandidateType()` / `CommittedStatus()` and expose the curve parameter (new accessors or `*LssHitParameterNV`).
  Repro: `CommittedIsLssNV` on `-target metal` → E36107. SPIR-V compiles it (`SPV_NV_linear_swept_spheres`).
- Orchestrator receipts at e49310561e: `slang-emit-metal.cpp:1420` emits the fixed
  `intersection_query<triangle_data, instancing>`; `:1553` emits the fixed `acceleration_structure<instancing>`.
- Context: Metal RT owner kaizhangNV (umbrella #11296, draft #12691;
  [project_12241](../imported/project_12241_metal_raytracing_part1_tracking.md)). Sibling #13690
  (`intersector<>` lowering, same reporter, filed the same minute) is also with slang-triager,
  in session `sess-1792136119166-0letay` ([record](13690-metal-rayquery-intersector.md)).
- 2026-10-16 ~07:37Z: live read clean (open, 0 comments, no labels/assignee, updated_at == created_at).
  The only session on the thread is this Main webhook session. Dispatched to slang-triager on
  `gh-issue-shader-slang/slang-13688`. The design call belongs to the maintainer: no fixer without a go-ahead.

**08:05Z, [Triage] (msg 24, file `triage-13688.md`).** Feature / medium / Metal emit + core module +
capabilities / P3. Reproduced at e49310561. Not a duplicate; the closest is stale #6614 "Support RayQuery for Metal".
- E36107 comes from `[require(glsl_hlsl_spirv, rayquery_lss_nv)]` (`hlsl.meta.slang:24011`). `RayQuery` is generic
  over flags only (`:22612`). Orchestrator verified both lines.
- **Q1: #12691 does not cover inline queries.** Its PROPOSAL.md:767 says "existing ray-query … APIs are not replaced".
  The tag emitter (`_emitMetalRayTracingTagList`) only feeds `intersector<>`, IFTs and `acceleration_structure<tags>`.
  #13686 is unrelated. (Triager's reading of the branch; I did not verify it.)
- Triager's MSL fact check: `curve_data`/`max_levels` [2,16] are valid on queries from 3.1. AS tags are probably
  unaffected (instancing/motion only). Curves additionally need `assume_geometry_type(curve)` +
  `commit_curve_intersection()`. `CommittedLssObjectPositionsAndRadiiNV` can never map (no fetch), so only
  `*IsLssNV` / `*LssHitParameterNV` can.
- Options. Q2 tag source: (A) the type, (B) inferred from accessors, as in #12691, or (C) a target option;
  suggested hybrid: B for curve_data and a type source for max_levels. Q3: (i) reuse the LSS accessors or
  (ii) new portable ones. The suggested slice comes after #12691 and reuses its emitter, gated on `metallib_3_1`.
- GitHub: comment issuecomment-6210949750 (nv-slang-bot, 08:02:59Z), Next-action @kaizhangNV. Type=Feature
  is set. No labels (`reproduced` is withheld for a feature gap, the same call as on #13690). Cross-ref to #13690 is cmt 6210678998.
- **PARKED** on kaizhangNV's direction. No fixer. Triager one-shot re-check **t-2c3ce2 at 2026-10-23T08:30Z**.
- Unfiled side note (operator call): `docs/user-guide/a2-02-metal-target-specific.md:117` still lists the
  acceleration structure as "(Not supported)".

**2026-10-19, maintainer activity.** kaizhangNV self-assigned at 16:09Z. jkwak-work added the `raytracing` label and
the Q4 2026 (Fall) milestone at 16:47Z. Neither left a comment.

**2026-10-20 13:13Z, reporter addendum (cmt 6291687104), arriving as a `pr_mention` webhook.** It has no @nv-slang-bot
mention and asks the bot nothing. Live body = payload (updated_at == created_at). The reporter adds two asks for "the
redesign":
(1) Per-primitive data: `get_{candidate,committed}_primitive_data()`, proposed as Metal-only
`{Committed,Candidate}PrimitiveDataAddressMetal()` returning a `uint64_t` device address. The reporter uses it today
through `__intrinsic_asm` on the query pointer.
(2) A curve workaround via the one-shot `intersector<curve_data, instancing>` in a `__requirePrelude`. The reporter
asks whether `acceleration_structure<instancing>` is accepted by that intersector; they can't compile it (no Mac).
(2) overlaps sibling #13690 (`intersector<>`).
Routing: forwarded to the triager owner session (`sess-1792136259662-c18z7r`) to record and HOLD: no bot post,
because the assigned maintainer owns the design. Asked the triager to fold the addendum and the assignment into
re-check t-2c3ce2 and to stay silent while kaizhangNV works on it.

**13:19Z, triager confirmed the hold (msg 36).** Nothing posted. Its spec reading of the AS-tag question (unverified,
no MSL compile here): `intersector<curve_data, instancing>` accepts `acceleration_structure<instancing>`, because the AS
need only match the instancing/motion tags (§6.19.2, §2.17.7, §2.17.1). The per-primitive-data accessors need Metal 3
and no extra tag. Both probes compile on 7251cc6. The memo is the triager's `memory/issues/triage-13688.md` › "Addendum
2026-10-20". Re-check t-2c3ce2 drafts any reply first and needs an Orchestrator go before posting.

**Resumes on:** a maintainer comment on #13688, or re-check t-2c3ce2.
