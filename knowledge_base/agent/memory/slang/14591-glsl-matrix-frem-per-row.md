---
type: chain-record
title: "slang#14591 — GLSL via-glsl: matrix `%` emits matrix-argument sign/mod/abs, glslang rejects"
description: Human jkwak-work 11-18; per-row matrix FRem legalization for GLSL-family codegen; draft PR #14599 review-complete, awaiting human review
---

# slang#14591 — glslang rejects `sign` of a matrix (`%` of two matrices) with -emit-spirv-via-glsl

Human (jkwak-work, self-assigned) 11-18 15:0xZ, bug/medium/P2, target-emit (GLSL). Same
author batch as #14590/#14592/#14593 (sibling chains).

**Chain:** webhook 15:05Z → 👀 + triager dispatch on canonical thread `gh-issue-shader-slang/slang-14591`
(msg id 3). Triaged + reproduced on master `4a1d62c5b` (triager sess k9qidv, `reproduced` label;
triage file: /workspace/inbox/a2a-1795014999670-eq9t6e/triage-14591.md). Fixer chain started by the
sibling sweep 15:16Z (sess jbyh7p — NOT minted by my dispatch; verified before I double-dispatched).
pr-mapping: PR #14599 → jbyh7p.

**Root cause:** `%` on float matrices lowers to ONE matrix-typed `kIROp_FRem` (core.meta.slang:3763→:1386);
the GLSL emitter (slang-emit-glsl.cpp:2653-2682) writes raw `sign(L)*mod(abs(L),abs(R))` — GLSL has no
matrix overloads, so glslang rejects `mat%mat`, `mat%scalar`, AND `scalar%mat`. Direct SPIR-V works
(emitArithmetic slang-emit-spirv.cpp:10793 expands per-row); Metal works via prelude helper. `fmod(m,n)`
works (stdlib per-row MATRIX_MAP).

**Fix (approach B from triage):** new `legalizeMatrixFRemForGLSL` pass (~110 lines,
slang-ir-glsl-legalize.cpp/.h; gate in slang-emit.cpp) — matrix-typed IRFrem → per-row ElementExtract
+ row FRem + MakeMatrix, scalar operands splatted. 9 commits, head `6f0c3ae82` (after r1: 3591fad9 →
44f18c806 → final). Tests: new tests/glsl/test-14591.slang 8/8 incl. real-GPU L40S `-vk
-emit-spirv-via-glsl` + glslang-validated text; new tests/diagnostics/matrix-mod-vector-operand.slang;
matrix-float.slang vk target re-enabled. tests/glsl 386/386, hlsl-intrinsic 681/681, diagnostics
1092/1092.

**Review:** r1 REQUEST_CHANGES (4 gaps — all applied: non-square float3x2, [noinline] helper,
direct-SPIR-V OpFRem filecheck, note accuracy); r2 APPROVE_WITH_NITS (all nits applied incl. the
gate-comment pipeline-model correction — via-GLSL-as-GLSL remap claim was wrong, the helper's isSPIRV
conjunction is the real reason). Codex PLAN/CODE/OUTPUT_REVIEW approve at final head.

**State:** **TERMINAL on our side 21:46Z (incl. the #14608 fold)** — draft PR **#14599** at head
**`5c4513dac`** (CI run 44402888963, `pr: non-breaking`, **`Fixes #14591` + `Fixes #14608`** in the
body — both auto-close on merge): pass renamed `legalizeFRemForGLSL` + `legalizeVectorFRemScalarDividend`
(vector splat). The one authorized reviewer delta round (REQUEST_CHANGES: 0 bugs, 2 gaps, 1 question —
all applied): gate-comment false clause removed (computePreciseInsts walks backward, rows stay covered);
23-value exact oracle on CPU + real GPU covering every shape incl. negative dividend + runtime
non-constant divisor (test cases merged into computeMain — compare harness hardcodes the entry point,
`-entry` dead for execution, render-test/slang-support.cpp:22); overclaim scoped to the `%` spelling.
Reviewer C's int-`%` sibling speculation EMPIRICALLY REFUTED (glslang accepts `3 % ivec3`) — nothing
filed, correct. Verified at head: test-14591 6/6 incl. real-GPU L40S -vk via-GLSL; tests/glsl 384/384;
hlsl-intrinsic 681/681; diagnostics 1092/1092; both repros exit 0; format clean; codex gates approve.
Ready-flip → weekly undraft list; reviewer [Resolution] 21:47Z: all findings applied at head,
0 bugs across 3 rounds, "nothing unresolved"; resume on PR #14599 webhook / human comment only. **WATCH: author
self-assignee (jkwak-work) — human self-fix → stand our draft down.**

**Side-finds (closed out 19:44Z; dup race resolved 19:5xZ):**
1. **Scalar-dividend vector `%`** (`0.75 % float3` → invalid GLSL; pre-existing on master).
   **DUP RACE:** triager filed **#14608** (19:44:09Z, `reproduced` label, canonical) and the fixer
   filed **#14609** (19:44:31Z, duplicate) — 22 s apart during chain close-out. **Canonical = #14608**;
   fixer posts a dup-pointer comment on #14609 (close = human). **BOTH `issue_opened` webhooks are
   self-echoes of our own filings — NO triage dispatch on either.** Routing (Main-approved, triager
   recommendation): **fold into PR #14599** — extend the legalization pass to vector-typed FRems
   (splatted scalar dividend), delta review round, `Fixes #14608` in the PR body (bot-owned →
   auto-closes on merge). No separate fixer chain.
   **Self-echo `issue_opened` arrived 19:45Z and was consumed FILED-ONLY (no 👀, no triage/fixer
   dispatch) — operator informed same minute. Fixer start still gates on the operator.**
   **RESOLVED 11-23: closed as duplicate by jhelferty-nv (cmt 7109798635, closed 18:11Z, label
   `Downstream: glslang`) — pending fixer-decision on this side-find is moot; nothing further.**
2. WGSL float-matrix `%` unimplemented (raw infix text): **NOT filed — no WGSL validator in the
   container** (tint/naga absent, "Tint not found"), rejection unvalidated on master → record-only;
   evidence lives in the r2 review (combined-review-slang-pr14599-r2.md) + the emitter scoping comment.
   Do not file without a validator-confirmed repro.

**History note:** fixer progress pings at 15:28 (build) and 16:46 (draft PR round 1) consumed with
no reply; r2 status 18:22 consumed likewise. The fan-out was reported to the dashboard (msg id 17).
