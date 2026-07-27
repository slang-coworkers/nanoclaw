---
name: project_12204_select_spvopt_passes
description: "#12204 select individual SpvOpt passes — enh/P3 PARKED jkwak Office-Yong design gate"
metadata: 
  node_type: memory
  type: project
  originSessionId: 300c1234-7825-4e49-b006-b14e7b6ec619
---

**shader-slang/slang#12204 — "Provide means to select SpvOpt"** — enhancement/P3, feature request. jkwak-work SELF-FILED + SELF-ASSIGNED; labels `Dev Opened` + `Office-Yong` (maintainer office-hours DESIGN gate). Milestone Q3 2026.

**Ask:** today `-OX` (0..3) is the only SPIR-V opt knob — each level is a hard-coded pass *preset* (`switch(optimizationLevel)` at `slang-glslang.cpp:316`, ~40 hand-unrolled `RegisterPass(CreateXxxPass())`). jkwak wants a new CLI arg to select *individual* SpvOpt passes. Related #11045 (slow `-g2 -O2` motivates granular control).

**Triaged @HEAD e438c5aef** (triager memo `triage-12204.md`). Clean primitive already exists: SPIRV-Tools `Optimizer::RegisterPassesFromFlags(vector<string>)` (`external/spirv-tools/include/spirv-tools/optimizer.hpp:140`) maps spirv-opt CLI flags → passes (SPIRV-Tools owns flag vocab, no hand-maintained table). Any pass-string needs a new versioned ABI struct `glslang_CompileRequest_1_3` (current `1_2` carries only `optimizationLevel`, `slang-glslang.h:105`, set at `slang-glslang-compiler.cpp:275`, parsed `slang-options.cpp:3589`).
- **Approach A (recommended):** new first-class flag (e.g. `-spirv-opt-passes <a,b,…>`, reuse `-capability a+b` split idiom) → `RegisterPassesFromFlags`.
- **Approach B:** wire existing `-Xspirv-opt <arg>` passthrough (already a registered target `SLANG_PASS_THROUGH_SPIRV_OPT`, but args don't reach `glslang_optimizeSPIRV`) — same ABI cost, UX call only.
- **Approach C REJECTED:** bulk presets (`RegisterSizePasses`/`RegisterPerformancePasses`) = more presets, not per-pass control.

**Open design Qs (owner/office-hours):** (1) A vs B surface/spelling; (2) is exposing spirv-opt flag vocab an acceptable semi-public commitment (tracks bundled SPIRV-Tools version); (3) interaction w/ `-OX` presets (override/additive/exclusive); (4) diagnostics for unknown flags.

**DESIGN RESOLVED by owner 07-23 (jkwak-work cmt 5061882883):** (1) surface = **Approach B** (`-Xspirv-opt` passthrough) — "sounds better"; (2) **NO diagnostic check** for the passthrough arg (consistent w/ `-Xdxc` etc.); (3) option is **ADDITIVE to `-OX`**. Answers all 4 open Qs. Design-map verdict was POSTED to GitHub (nv-slang-bot cmt 5061681364, 17:59Z).

**State: DRAFT PR #12206 OPEN 07-23** (https://github.com/shader-slang/slang/pull/12206, branch fix/issue-12204 @ 66b4d4e691). jkwak-work gave explicit "@nv-slang-bot, make a PR" (cmt 5061940269) after design gate cleared (triager ack cmt 5061921273).

**PR #12206 (Approach B exactly):** 5 files +212/−19. New versioned `glslang_CompileRequest_1_3` ABI struct carries `-Xspirv-opt` flags across slang-glslang C boundary → `spvtools::Optimizer::RegisterPassesFromFlags` ADDITIVE on top of `-OX` preset; forwarding gated on spirv-opt instance (so `-Xglslang` not misrouted); fail-on-partial-registration (no Slang validator). +test tests/spirv/spirv-opt-passthrough.slang. Repro 3/3 (BASE/STRIP/O0, mutation-proven), regr 530/530 spirv + 337/337 glsl. Manual: `--strip-debug` OpName 4→0, `-O0` inert, invalid flag→exit255. codex PLAN/CODE/OUTPUT APPROVE. Labels `pr: non-breaking` + `pr: new feature`. ci_failed webhook = benign priority-yield (0 real failures, retry-reruns).

**R1 review addressed 07-23:** 3-reviewer pass = APPROVE_WITH_NITS (0 bugs, 3 gaps none merge-blocking). Fixer re-pushed head **2aa7eb79de**: +4th test (invalid `-Xspirv-opt` flag fails compile), docs in docs/user-guide/08-compiling.md (pass-selection scope, `-O0`-inert), `-emit-spirv-via-glsl` limitation documented (Gap 2 = scoped follow-up), ABI prefix-compat invariant in comments, `_invoke` now diagnoses `-Xspirv-opt` vs pre-`_1_3` lib (was silent drop) + filled `getVersionString` `_1_2` branch. test 4/4, spirv 531/531, glsl 337/337, codex triple-approve. Reviewer re-run dispatched.

**R2 review addressed 07-23:** round-2 3-reviewer pass = APPROVE_WITH_NITS (0 bugs, 2 gaps, none blocking; down from 3 — doc+invalid-flag gaps resolved). Substantive item = `_invoke` pre-`_1_3` downgrade guard coupled fail-decision to `request.diagnosticFunc` non-null (latent-not-reachable today since compile() always sets it, but flagged unanimously by all 3 reviewers). Fixer re-pushed head **7dc9dec332**: guard now fails UNCONDITIONALLY w/ best-effort diagnostic — codex caught that a `SLANG_ASSERT` would compile to `__builtin_assume` in release and ELIDE the null-check, so removed it. +ABI invariants/size-clamp asymmetry in comments. Gap 2 (`-emit-spirv-via-glsl`) stays deferred+documented (reviewer+maintainer agreed). test 4/4, spirv 531/531, codex triple-approve. Round-3 reviewer re-run dispatched.

**REVIEW-COMPLETE / MERGE-READY 07-23, head 1e8d639942.** Arc R1(3 gaps)→R2(2 gaps)→R3(0 gaps, 1 optional nit taken) — **0 bugs throughout**, all rounds. R3 = APPROVE_WITH_NITS, Gap 1 confirmed resolved + UB-free, reviewer says merge-ready. Fixed across arc: invalid-flag test, `-Xspirv-opt` docs, ABI-invariant comments, triple-converged `_invoke` guard hardening (unconditional fail; dropped `SLANG_ASSERT`→`__builtin_assume`-in-release UB catch by codex, now a shared learning). Gap 2 (`-emit-spirv-via-glsl` inert) deferred+documented per reviewer+maintainer. Verify: test 4/4, spirv 531/531, glsl 337/337, codex PLAN/CODE/OUTPUT approve.

**MAINTAINER REVIEW 07-24, head 71aaf84802.** jkwak-work left 2 inline comments, both addressed+replied on-thread: (1) inheritance Q → refactored `struct glslang_CompileRequest_1_3 : public glslang_CompileRequest_1_2` (layout byte-identical, verified offsetof probe; trivially-copyable; `set()` base-slice assigns; `_invoke` downgrades slice to typed base; +`is_trivially_copyable`/`is_base_of` static_asserts); (2) `../compiler-core/` include → `compiler-core/` in slang-emit.cpp. Verify: test 4/4, spirv 531/531, glsl 337/337, codex PLAN/CODE/OUTPUT approve (OUTPUT_REVIEW caught wrong "aggregate init is gone" claim in reply text pre-post). Reviewer re-dispatched on new head.

**R5 addressed + NON-DRAFT 07-24, head 5d7aad1a08.** Round-5 3-reviewer pass = APPROVE_WITH_NITS, 0 bugs (5 rounds, 0 bugs throughout). ABI inheritance refactor empirically verified byte-identical (reviewer's probe + fixer's). R5 fixes: 2 factually-wrong comments corrected, `-O0`/old-lib guard scoped so `-O0 -Xspirv-opt` INERT (matches doc, preserves #11662), size-regression `static_assert` + field-lifetime doc, +2 tests (multi-flag accum, `-Xglslang` non-routing gate). Declined 3 cosmetic nits. **Rebased onto master** (was 5 behind). Gates: 6/6 test, spirv 533/533, glsl 337/337, codex triple-approve.

**GH state VERIFIED (get_pull_request 07-24):** PR #12206 `draft:false`, `Closes #12204`, base master, head fix/issue-12204, assignee jkwak-work, requested reviewers jkwak-work + pdeayton-nv, labels `pr: new feature`+`pr: non-breaking`, open/not-merged. Fixer attributes the non-draft flip to a MAINTAINER (fixer did NOT self-flip) — consistent w/ jkwak active review + pdeayton-nv added as reviewer; flip actor not directly readable from tools.

**test-falcor RED = INFRA** (fixer): fails in git checkout/submodule phase (no compile/test error), 2/5 recent MASTER runs also red, change only activates on `-Xspirv-opt` path Falcor doesn't exercise. NOT a real regression — don't mistake for one.

**R6 addressed 07-24, head d887a75714 (COMMENT-ONLY, no code/behavior change).** Round-6 = APPROVE_WITH_NITS, 0 code bugs, all R5 fixes verified sound. 2 comment-accuracy nits fixed: (1) XGLSLANG test comment relabeled to claim only the real property it proves (reviewer caught it doesn't exercise the instance gate; via-glsl alt also vacuous due to Gap 2); (2) dropped inaccurate "copies before returning" ABI-field lifetime comment. codex triple-approve, 6/6 tests. test-falcor NOT red on current head; reviewer concurred earlier red was infra.

**MAINTAINER ACTIVELY MERGING-PATH 07-24.** jkwak-work RESOLVED both his earlier review threads (`../` include on slang-emit.cpp + inheritance-refactor on slang-glslang.h — fixes satisfied). Then 1 new comment "Too verbose." → fixer head **05479d71ea** trimmed 7-line forwarding comment to 2 lines (kept load-bearing gate rationale: class backs both spirv-opt + glslang passthroughs so `-Xglslang` must not reach optimizer; dropped redundant via-glsl aside + lifetime note already on ABI field). Comment-only; 6/6 tests; codex OUTPUT approve. test-falcor infra-flake re-run cleared earlier.

**ALL 3 jkwak THREADS RESOLVED 07-26** (include, inheritance, verbose-comment — head 05479d71ea trim satisfied the last). GH state VERIFIED (get_pull_request 07-26): open, **NOT merged** (`merged_at:null`), non-draft, `Closes #12204`, assignee jkwak-work, **requested_reviewers now ONLY pdeayton-nv** (jkwak DROPPED off requested-reviewer list = his pass complete). labels new-feature+non-breaking.

**State: SHIP-READY on correctness (6 review rounds, 0 bugs). NON-DRAFT, awaiting final approval/merge — MAINTAINER'S CALL** (bot can't approve own PR; ready/merge OPERATOR-gated). jkwak completed his review (all threads resolved, off requested-reviewers); possibly pending pdeayton-nv. Fixer holding for approval/merge/CI via webhook. PR = public footprint. NO operator push (maintainer driving on GH = primary surface).

**Impl shape (captured for whoever implements):** forward parsed `-Xspirv-opt` DownstreamArgs into OPTIMIZE-SPIRV request (today only `optimizationLevel` reaches `glslang_optimizeSPIRV`) via new `glslang_CompileRequest_1_3` field → `Optimizer::RegisterPassesFromFlags(...)` ON TOP of preset passes (additive).

Orthogonal: PR #12187/#11988 = slang-test `-OX` (test-harness level), see [[project_11988_nightly_spvopt_workflow_parked]].
