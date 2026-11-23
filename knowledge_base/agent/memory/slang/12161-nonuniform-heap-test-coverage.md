---
type: chain
title: "slang#12161 — NonUniform DescriptorHandle round-trip: non-SPIR-V test coverage (PR #14667)"
description: Maintainer-directed tests-only PR for the .Handle construction spelling gap; draft PR #14667, chain LIVE
---

# slang#12161 — non-uniform heap test coverage (PR #14667)

**Issue:** #12161 — bot-filed tracking item split from #12110/PR #12116: NonUniform on
`DescriptorHandle<T>` round-trip for non-SPIR-V targets; the non-uniform marker survives on
textual targets but lands nested inside the makeVector arg (`uint2(NonUniformResourceIndex(i),0U).x`)
— by design, not proven a defect. Existing `tests/language-feature/descriptor-handle/desc-heap-nonuniform.slang`
covers only the subscript spelling; the `.Handle` construction spelling is the test gap.

**Chain:**
- 11-20 ~16:0xZ: maintainer **jhelferty-nv** directed the bot (cmt 7044166728, real @nv-slang-bot mention):
  "Create a small, targeted PR for addressing the test gap."
- Dispatched to **slang-fixer sess-1795190543812-c5w1fd** on `gh-issue-shader-slang/slang-12161`;
  brief: tests-only, FileCheck must pin the actually-emitted **nested** form (learning
  `1784539603707-nonuniform-on-descriptorhandle-round-trip-…`), no compiler changes.
- Fixer build green in wt-slang-12161 (Debug slangc `2026.22.1-22-g410071448`, log build/build.log).
- **11-20 16:45Z: draft PR #14667** @ head `79b514ced`, branch `fix/issue-12161`, title
  "Tighten and extend non-uniform descriptor-heap index test coverage" (2 files, +47/−7: tightened
  loose HLSL CHECK, added GLSL leg, added `.Handle`-construction fixture with HLSL+GLSL legs).
  pr-mapping registered (`ag-1780667166439-vmjrwe` → c5w1fd). Explanation HTML:
  `/workspace/inbox/a2a-1795193400163-n4cw72/2026-11-20-shader-slang-pr14667-nonuniform-heap-tests.html`.
- **Premise correction (fixer report 16:51Z):** the relayed "pin the nested form" premise was STALE —
  HEAD `410071448` (post-#12263) already emits the canonical `resource[NonUniformResourceIndex(i)]`
  form for BOTH spellings. Fixer derived all CHECKs from actual emit (judgment call, logged in plan);
  touched tests 3/3, descriptor-handle dir 131/131 (2 ignored), PLAN/CODE/OUTPUT_REVIEW approve.
  Correction learning appended to shared store (supersedes `1784539603707`'s nested-form claim).
  CI run 44776599915 triggered; issue-thread 5-bullet at issuecomment-7045199576.
- **Peer review R1 (17:25Z): REQUEST_CHANGES, 0 bugs / 1 gap** (missing DXIL downstream-compile leg
  named by issue step 3, zero sampler-heap `.Handle` coverage); verdict on fixer's edge, artifacts
  `runs/A-14667-r1/combined-review.md`.
- **11-20 18:22Z: maintainer jhelferty-nv reviewed the draft inline himself** (review 5997104349,
  5 findings, AI-assisted per his note) — all five applied in 1f2cf84ec+3f6cad141+**`6578c27e8`**
  (still tests-only, 2 files, +74/−10). DXIL legs strengthened beyond the ask: FileCheck input is
  DXC's disassembly, non-uniform observable as createHandleFromHeap's final i1 operand — both files
  pin it, answering #12161's DXC downstream-propagation question. Stage fix `[shader("compute")]`.
  Ack cmt 7046803087, outcome cmt 7047300069, CI 44791344599 in flight.

- **Peer review R2 (18:45Z): APPROVE_WITH_NITS at `6578c27e8`** — fixer's mid-round pushes met all
  5 maintainer asks (verified line-by-line + empirical DXC pass-through probe: the new
  `createHandleFromHeap` flag pins match DXC's output verbatim, closing #12161's DXC propagation
  question by evidence); A 0 bugs / 2 gaps resolved by the pushes, Devin clean, C 7 advisory; top nit
  = glslang `-emit-spirv-via-glsl` leg (probe-proven to pass). Codex OUTPUT_REVIEW r1–r3 approve.
  Artifacts `runs/A-14667-r2/combined-review.md`, probes `runs/probe-14667-r2/`.

**State (19:10Z [Fix Report]):** bot-side work TERMINAL — final head **`8ac38d6e9`** (nit + advisories
applied, 2 files +83/−10, all maintainer findings met; declined only issue-number refs in comments).
Touched tests 3/3 + 4/4 legs PASS, descriptor-handle dir 133/133 (2 pre-existing ignored). CI run
44797156179 pending (draft manual trigger). Ready-flip pending weekly list (carry-over row added
11-20, live-verified draft+head; CI to re-verify before listing). Awaits maintainer verdict —
jhelferty-nv is shepherd and already engaged (he reviewed the draft inline). Worktree + sentinel
retained until PR disposition. Post-merge: issue #12161's DXC/glslang propagation question is
answered by evidence (R2 probe + DXIL/glslang legs) — triager/resolution comment when dispositioned.
