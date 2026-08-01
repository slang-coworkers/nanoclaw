---
type: project
title: "#11135 IRTypeAlignmentAttr (draft PR #12306) — REQUEST_CHANGES, contiguity bug"
description: Maintainer-requested IRTypeAlignmentAttr impl; peer review found a triple-verified 🔴 addAttrs interleaving bug
---

# shader-slang/slang #11135 → IRTypeAlignmentAttr — draft PR #12306

**Origin:** tangent-vector (core maintainer) `@nv-slang-bot` mention on PR #11135
("[Reflection]: Track 'used' for uniforms", author ramang-unity, draft). Asked bot to
implement the `IRTypeAlignmentAttr` he sketched, generate it during type-layout→IR lowering,
then systematically replace ad-hoc alignment/stride derivation across IR consumers. Split into
stacked pair if consumers numerous. Escape hatch: respond if alignment already encoded.

**Owner chain:** Main → slang-fixer (impl) → slang-reviewer (internal peer review, verdict via Main).
Canonical thread `gh-issue-shader-slang/slang-11135`.

## ✅ PR-A MERGED (2026-08-01 02:31Z) — TERMINAL
tangent-vector merged **PR #12306** as-is at approved HEAD `bd59d84a4d`, merge commit **`43f979ad08`**.
`IRTypeAlignmentAttr` (stable name 901) on master. **Version-bump question: maintainer merged WITHOUT
bumping `k_maxSupportedModuleVersion` (stayed 27) → adjudicated NOT required** for this attr op (despite
#12256 precedent for `SPIRVUntypedPtr`). Validated the "surface the finding, don't push over a fresh
maintainer approval, let him decide" call (correctness reviewer had dropped that item as CI-advisory;
fixer argued should-fix via #12256; maintainer resolved it his way cleanly). 16 codex + 2 peer-review
rounds. Worktree + sentinel cleaned. PR-A chain TERMINAL.

**Still open: PR-B (stacked systematic consumption)** — HELD on tangent-vector's scope answer
(reflection-only consumers vs. large two-system unification with `slang-ir-layout.cpp`) + his response
to fixer's element-stride due-diligence reply. Parks silently if no response; re-dispatch (Main→fixer)
only on his answer or operator direction. **Issue #12307** (JSON reflection global-scope, triager) also
open, design-iterating with tangent-vector.

## State (2026-07-31) — [historical] BLOCKER CLEARED, draft, operator-gated
- **PR-A = draft #12306**, branch `dev/slang-fixer/slang-11135-align-attr`, head **bd59d84a4d**
  (75e037d48d → af40a39c88 [maintainer's 3 inline comments: renames to
  `getSizeInBytes`/`getAlignmentInBytes`/`getStrideInBytes`/`getElementStrideInBytes`,
  ResInfo::alignment sentinel 0→default 1, doc fixes] → **bd59d84a4d** [REQUEST_CHANGES fix]).
  Attribute confirmed genuinely missing (front-end `TypeLayout::uniformAlignment` dropped at
  `_lowerTypeLayoutCommon`).
- **Reviewer re-check @ bd59d84a4d: BLOCKER CLEARED → APPROVE_WITH_NITS.** 🔴 contiguity bug fixed
  (two-pass emission: all size attrs, then all alignment attrs; empirically confirmed on built binary,
  existential size-attrs no longer truncated). New regression test `ir-type-alignment-attr-existential.slang`
  is a REAL guard — reviewer ran its own revert drill (RED on bug-reinject → GREEN on restore); the
  fixer's first test attempt (`//TEST:REFLECTION`) was a FALSE guard (AST-reflection API doesn't observe
  IR truncation). GAP1 fixed (`_occupiesLayoutUnit` = `!isFinite() || value!=0`, covers invalid+infinite).
  GAP3 fixed (`CHECK-NOT: TypeAlignment(1)`). GAP2 (untested byte-unit stride accessors) deferred to PR-B
  — accepted (should-not-must). 614/614 regression; codex re-approved (but note: codex passed the BUGGY
  version too — reviewer's independent binary check is what closed it). Only residual low-sev clarity
  nits remain, none blocking. Re-check report: `/workspace/inbox/a2a-1785540656796-xe15jl/recheck-bd59d84a4d.md`.
- **✅ tangent-vector (maintainer) APPROVED @ bd59d84a4d (2026-07-31 23:59) + flipped PR to NON-DRAFT
  himself** (his action, not ours — `reviewDecision: APPROVED`, approval commit == headRefOid, valid).
  Fixer correctly holding: NOT pushing (any commit auto-dismisses approval, incl. non-blocking nits),
  NOT merging (operator-gated), NOT manual-dispatching CI (non-draft → `pull_request` CI runs on its own).
  **MERGE = operator/maintainer call.** Surfaced merge-ready state to operator (push). PR-A is DONE to
  approved+ready state.
- **NEXT-STEP:** await merge (maintainer may self-merge, or operator authorizes our bot). PR-B (systematic
  consumption) still HELD on tangent-vector's PR-B scope answer + his response to fixer's element-stride
  due-diligence reply.
- **PR-B (systematic consumption) HELD** pending tangent-vector's scope answer to a design-fork
  question the fixer posed on-thread: his predicted SPIR-V "divining" sites use a separate
  rule-parameterized engine (`slang-ir-layout.cpp`) that doesn't read reflection `IRTypeLayout` —
  so PR-B is either small (reflection consumers) or a large two-system unification.
- **Second maintainer request on same PR** → slang-triager opened **issue #12307** (JSON reflection
  global-scope completeness, design-only proposal; sub-thread `.../json-reflection-scope`).
  tangent-vector iterates in #12307 before implementation.

## Peer-review verdict: REQUEST_CHANGES (1 bug + 3 gaps) @ af40a39c88
Reviewer's interim leaned APPROVE_WITH_NITS; the correctness pass FLIPPED it.

**🔴 BUG (must-fix, triple-verified: source + rebuilt-binary IR dump + codex adversarial):**
`IRTypeLayout::Builder::addAttrs` (slang-ir.cpp:1068) emits the `IRTypeAlignmentAttr` INSIDE the
per-resInfo loop, right after the Uniform (enum idx 8) size attr — splitting the size-attr run.
`findAttrs<IRTypeSizeAttr>()` stops at first non-T (contiguity invariant, slang-ir.h:594), so
`getSizeAttrs()` silently truncates all size attrs for kinds with enum idx > 8
(ExistentialTypeParam=18, ExistentialObjectParam=19, DescriptorTableSlot=9, RegisterSpace=12…).
Repro: `struct S { float4 color; ILight light; } ConstantBuffer<S> cb;` → bind-existentials.cpp:219
`findSizeAttr(ExistentialTypeParam)`→null→slotCount=0→existential slot binding miscompiled; also
drops reflection metadata (metadata.cpp:219). Empirically reproduced on shipped af40a39c88.
Orthogonal to force-push changes — latent since first commit. Fix: emit alignment attrs in a
SEPARATE pass after all size attrs (preserve both runs' contiguity).

**🟡 GAPS:** (1) alignment silently dropped to 1 for `isInvalid()`-size (generic-length array)
uniform types with valid uniformAlignment (lower-to-ir.cpp:387; CLAUDE.md silent-impossible-shape
pattern). (2) `getUniformStride`/`getElementUniformStride` zero callers + no direct test; two-operand
attr form never exercised (defer to PR-B w/ test, or add SLANG_UNIT_TEST now). (3) FileCheck test
all CHECK-DAG, no CHECK-NOT, doesn't tie alignment to layout — passes under swapped/spurious
alignments (add ordered CHECK: + CHECK-NOT: TypeAlignment(1)).

**Cleared:** fixer's concern #1 (element array stride) is NOT a bug — code correctly rounds element
size to ARRAY alignment; float[N] cbuffer ⇒ stride 16, empirically confirmed. Concern #2 (absence⇒1)
holds everywhere. Concern #3 (preservation) complete. Devin 0/0/0. Clarity 11 nits (C001 fixed).
diff_hash 5da974900687-af40a39c88.

## Next
Fixer fixes 🔴 bug (+regression test for existential-in-cbuffer size-attr enumeration) + gaps +
cheap nits → re-verify → reviewer re-checks the contiguity fix → PR stays DRAFT (operator-gated,
never auto-ready/merge). PR-B still held on tangent-vector. Review report (my filesystem):
`/workspace/inbox/a2a-1785536389096-wag1pj/combined-review.md`.
