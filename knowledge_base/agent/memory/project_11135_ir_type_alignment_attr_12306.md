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

## ✅✅ CHAIN WRAPPED (2026-08-01 22:22Z) — all fixer deliverables landed
- **PR-A #12306** — MERGED (`43f979ad08`, `IRTypeAlignmentAttr` stable-name 901 on master).
- **Version-bump #12315** — ✅ MERGED 2026-08-02 00:56Z (`k_maxSupportedModuleVersion` 27→28, min stays 4,
  on master; verified via gh API — merged_at set, base master). Last open deliverable → **chain fully TERMINAL.**
- **PR-B — NO follow-on PR warranted.** Reflection `IRTypeLayout` layer has no ad-hoc consumers to convert;
  maintainer DECLINED the natural-layout/SPIR-V unification (on-demand `.Load<T>()` sites justified, can't
  force AST layout there); sole genuine adopter = #11135's own array-stride special-case → replaced with
  `getElementStrideInBytes()` if/when #11135 reworks onto merged attr (that's #11135's separate PR, NOT ours).
- **SPIR-V ArrayStride** — verified emitted (#12306 cmt 5153695709), needs no new attr.
- **Tech-debt issue #12316** — FILED OPEN (never auto-closed), linked #12306 cmt 5153706043; tracks
  front-end `TypeLayout` vs IR natural-layout policy duplication; tracking-only/not-urgent.
- **NOT ours / watch-only:** #12315 maintainer merge; #11135's own ongoing draft PR (separate reviews, we
  don't characterize its mergeability); tech-debt #12316 (maintainer owns open/close). RE-ENGAGE only on a
  fresh human comment on any of these threads.

## ✅ PR-A MERGED (2026-08-01 02:31Z) — [detail]
tangent-vector merged **PR #12306** as-is at approved HEAD `bd59d84a4d`, merge commit **`43f979ad08`**.
`IRTypeAlignmentAttr` (stable name 901) on master. **Version-bump question: maintainer merged WITHOUT
bumping `k_maxSupportedModuleVersion` (stayed 27) → adjudicated NOT required** for this attr op (despite
#12256 precedent for `SPIRVUntypedPtr`). Validated the "surface the finding, don't push over a fresh
maintainer approval, let him decide" call (correctness reviewer had dropped that item as CI-advisory;
fixer argued should-fix via #12256; maintainer resolved it his way cleanly). 16 codex + 2 peer-review
rounds. Worktree + sentinel cleaned. PR-A chain TERMINAL.

## Re-opened 2026-08-01 21:36Z — tangent-vector two directives (both underway)
1. **Version bump — REQUIRED after all.** Maintainer asked fixer to push the omitted IR module-version
   bump as a follow-up → resolved the advisory-vs-required question to REQUIRED. Shipped **draft PR #12315**
   (`k_maxSupportedModuleVersion` 27→28, min stays 4), `pr: non-breaking`, `report_pr_created` done, linked
   on #12306, codex OUTPUT_REVIEW approved. Draft/operator-gated.
2. **PR-B (systematic consumption) — SURVEY DONE, reflection-layer has ~NO targets.** Maintainer confirmed
   he wants the stacked follow-on; fixer's source-verified consumer survey
   (`/workspace/agent/reports/slang-11135-prb-scope.md`) found: NO IR-level `IRTypeLayout` consumer computes
   alignment/stride ad-hoc (all just call `getElementTypeLayout()` for traversal); reflection API/JSON stride
   paths are AST-based (`slang-reflection-api.cpp` reads AST `TypeLayout::uniformAlignment` via `convert()`,
   line 72/1356 — IR attr not reachable there, out of scope); the ONLY ad-hoc "divining" is the
   natural-layout/SPIR-V engine (`slang-ir-layout.cpp` + emit-spirv/glsl/wgsl) = the large unification held
   pending his explicit word; the one genuine adopter is #11135 itself (array element-stride special-case,
   on ramang-unity's branch not master → #11135 adopts `getElementStrideInBytes()` on rebase onto merged
   #12306). **So PR-B is either (a) empty at reflection layer, or (b) the broad SPIR-V/natural-layout
   unification.** DECISION: fixer to post honest (a)/(b) reply to tangent-vector on #12306 asking which —
   crediting that his SPIR-V-divining prediction was CORRECT (the divining IS there, it's just the big
   unification). Do NOT open empty PR-B; do NOT start unification unprompted. Held for his answer.
   If he picks (b): design-sensitive, wants a plan/scope pass before implementation, not a straight dispatch.

## tangent-vector final directives (2026-08-01 ~22:15Z) — PR-B chain essentially wrapped
- **(b) SPIR-V/natural-layout unification — OFF THE TABLE.** He said explicitly: do NOT convert the
  on-demand natural-layout sites (`.Load<T>()`-style where concrete `T` isn't known where AST layout is
  computed — forcing AST layout down there may not be possible). No PR-B unification work.
- **SPIR-V ArrayStride double-check — DONE (answered #12306 cmt 5153695709).** Slang DOES emit `ArrayStride`
  on cbuffer array types (`OpDecorate %_arr_float_int_4 ArrayStride 16` for `float b[4]` std140; offsets
  0/16/80). From explicit `getArrayStride()` on the IR array type (set in buffer-element-type lowering),
  fallback natural-layout engine. Correct, not default-relying, needs no new attr.
- **#12315 (version bump) APPROVED @ `bcd851aa29`, flipped non-draft by maintainer.** Operator-gated merge
  (his merge/authorize; no push, no self-merge — same posture as PR-A).
- **Tech-debt tracking issue — AUTHORIZED to file (maintainer explicitly requested it).** Tracks the
  two-layout-path policy duplication (front-end `TypeLayout` vs IR natural-layout engine). Dedup confirmed
  (no existing issue, REST search). **File OPEN — NEVER auto-close** even though he floated "instantly close
  as out-of-scope"; open/close is his call. Fixer reports issue# back for tracking + future-webhook routing.

**Infra (2026-08-01, ~21:36Z→persisting ~22:15Z):** `gh` GraphQL (`pr create`/`edit`/`comment`) AND
`gh search` throwing **401s** — now PERSISTENT (~40min) + wider surface, NOT a transient blip. REST
(`/issues/comments`, `/pulls`, `/labels`, `search/issues` via `gh api`) works — fixer routing via REST, work
NOT blocked. Surfaced to operator: recommend GitHub PAT/OneCLI re-login when convenient (401 = re-login, NOT
restart — see [[project_github_actions_graphql_401_outage]]). Watch board-sync #12062, slang-pr-report,
supervisor cron (GraphQL-dependent).

**Issue #12307** (JSON reflection global-scope, triager) open, design-iterating with tangent-vector.

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
