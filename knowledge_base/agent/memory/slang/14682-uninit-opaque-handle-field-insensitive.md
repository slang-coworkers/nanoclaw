---
type: chain
description: slang#14682 E56003 fatal on uninit struct with unused Texture2D field — human-filed, triaged, fixer chain live
---

# slang#14682 — E56003 field-insensitive "use of uninitialized opaque handle"

Human-filed 11-21 00:56Z by pdeayton-nv (R6 dispatch; 👀 01:00Z). Uninit struct containing a
`Texture2D` field passed to a function → fatal E56003 even though the texture is never read;
expected only the E41016 warning.

## Chain state (as of 11-21 01:30Z)

- **Triage (triager sess hi3a5x):** bug / medium / P2, IR type legalization. Reproduced on master
  `f47933b1e`. Root cause: `legalizeUndefined` (slang-ir-legalize-types.cpp:2072-2110) rejects any
  undef whose type *contains* an opaque field — `isOpaqueType` walks transitively into struct
  fields with zero usage sensitivity. Probes: bare struct copy with no call still trips E56003;
  fatal on all targets; `-disable-non-essential-validations` kills E41016 but not E56003 (separate
  "essential" validation class). Leaf image-typed undefs skip this site and reach the SPIR-V-only
  #14342 pass (use-sensitive); the struct spelling never does.
- **GitHub artifacts:** triage comment 7055108035 (5-bullet, 01:26Z), `reproduced` label + Issue
  Type Bug. No duplicate; related: #14342, #14646/#14649, #14076/#14081, #13700, #9388, #11573.
- **Fixer LIVE** since handoff ~01:10Z (sess pldciv, dispatched by triager on canonical thread
  `gh-issue-shader-slang/slang-14682` BEFORE my 01:25Z step-6 nudge — nudge arrived mid-post and
  was overtaken by events; memo in triager's memory/issues/triage-14682.md). Approach A
  recommended: implement the in-code TODO at slang-ir-legalize-types.cpp:2104-2107 — decompose undef
  aggregates into leaf undefs so unused opaque fields DCE away and used ones hit the #14342
  rewrite-or-diagnose machinery. Fallback B: diagnose only leaf-opaque types (risks losing the
  diagnostic on non-SPIR-V targets).
- **PR LIVE 05:19Z 11-21:** draft PR **#14686** "Decompose undefined aggregates during type legalization"
  @ head `5fac1baa` (5 files +238/−51, `pr: non-breaking`; mapping → fixer sess pldciv; explanation
  cmt 7057781073; CI run 44870072780). Approach A shipped: undef aggregates decompose to per-leaf undefs
  during type legalization; unused opaque leaves DCE away (repro compiles with only E41016 on all
  targets); used fields adopt leaf-spelling semantics (SPIR-V: #14342 rewrite-or-diagnose, broadened to
  arrays per VUID-12464; non-SPIR-V: warn-only per tests/bugs/13074 contract). Two intermediate designs
  (non-SPIR-V generic diagnosis; target-agnostic arg specialization) implemented, probe-rejected (broke
  13074 / undefined-combined-texture-sampler-whole-value), reverted — documented in explanation comment.
  Reviewer round 1 **verdict 06:15Z: REQUEST_CHANGES — 0 bugs / 3 gaps / 0 questions** (combined A/B/C;
  top concern E56003-related), reviewed against head `5fac1baa`. **Session fault 07:05–07:48Z+: pldciv
  turns partially execute then die before answering** — post-verdict gap-fix commits were pushed anyway:
  `1068bea2` + `cb52751b` (06:40Z: implicit-deref/wrapped-buffer decomposition + target-matrix tests) and
  `a2531100` (07:08Z: assertion-macro fix); head now `a2531100`. Bounces: 07:05Z (triager handoff re-send)
  and 07:48Z (my coordination note msg 55 / queued items) — identical generic NanoClaw error. Ruled out:
  cost-cap (ok, $28.71/$180), container (running), fleet fault (sibling fixer cjhbhb/#14687 answered
  normally 07:20Z) → session-level fault, likely context overflow at the end of heavy turns. Operator
  alerted (dashboard msg 75) + corrected (msg 81: work advances despite bounces; reset with worktree
  care; review round 2 needed on new head after recovery). Triager parked with one-shot recheck
  t-0ad771 @ 13:00Z, repointed twice (msgs 77+83): check BOTH pldciv out-messages AND PR head movement
  past `a2531100`; escalate if neither; never re-send the stale triage handoff. **RECOVERED 13:06Z** —
  attribution corrected (verified 13:1xZ by orchestrator task session ouivsb): the wake that revived
  pldciv was **Main's own pinned third wake attempt** (13:04Z, target_session_id+thread_id, correctly
  shaped "do NOT redo the handoff, operative pending inbox is…", landed as pldciv seq 24) — NOT the
  triager's retry (t-0ad771/1hgiqd fired 13:00Z, correctly sent NO wake per the no-re-delivery
  instruction, only escalated; kr836n's 13:07Z dashboard resolution note and this file's earlier text
  misattributed it — dashboard correction sent 13:1xZ).
  revived pldciv. **Round-2 work complete on head `a2531100`** (fixer report, 13:06Z): all 3 REQUEST_CHANGES
  gaps addressed (structural implicitDeref/wrappedBuffer LegalVals; isOpaqueType doc-breadth alignment +
  buffer/nested/glsl/wgsl matrix entries; glsl/wgsl parity pinned as compile-only per the reporter's own
  #14342 test — documented, no new fatal check) + codex-found release-build fix (side effects inside
  SLANG_ASSERT = commit a2531100). New test 32/32, targeted 172/172, diagnostics 1155/1155, full-suite
  residuals master-baseline; CI run 44878861246. Critique re-record in progress (bounces wiped two
  critiques; PLAN+CODE already re-approved 07:10/07:15Z); [Fix Review Request] round 2 → slang-reviewer
  expected ~13:36Z with full gap disposition, diff base `a2531100` (round 1 reviewed `5fac1baa`).
  **13:33Z: THIRD bounce** — the critique-re-record + round-2 dispatch turn died (reviewer idle since
  06:15Z = dispatch never landed). Diagnosis refined: session is **flaky, not stalled** — light turns
  succeed (13:06 answer), heavy turns die late (07:05/07:48/13:33, each after substantial work);
  consistent with context exhaustion. Head-liveness signal blind now (work complete; head stays
  a2531100 until round 2). Operator thread re-opened (msg 95; my msg 87 closure was premature):
  session-targeted reset of pldciv, still NOT group restart. Triager corrected (msg 97): no re-sends,
  no new task; its wake-revival recovered the work once but the fault persists.
- **Operator:** fan-out report sent to dashboard 01:30Z (msg 37); PR-number update 05:2xZ. Human-filed
  precedent (#14632,
  #14646) allows the fixer start without a maintainer GO; operator-gate applies only to bot-filed
  follow-ups.
- Scratch: triager's /workspace/agent/scratch-14682/ (repro.slang + variants a–g).
