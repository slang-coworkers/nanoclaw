---
type: value
title: "slang#14604 — `-specialize` checks its type argument with a stale thread-local AST builder"
description: Human-dev-filed (skiminki-nv) order-dependent debug-assert failure; triager dispatched 11-18 on canonical thread.
---

# slang#14604 — `-specialize` stale current-AST-builder (debug assert)

**CHAIN TERMINAL 11-19 12:29Z: PR #14605 MERGED by skiminki-nv @ `c0188daeb` (issue auto-closed
12:29:11Z, Main-verified). Total chain time: filed 11-18 18:17Z → merged 11-19 12:29Z (~18h).**
Outstanding follow-ups (operator/maintainer-gated, non-blocking): #14611 reflection-API guard
(parked, triager re-check 2026-11-25) + recommended two-session unit-test PR. Webhooks on #14604
or the merged PR need no dispatch.

- **Filed 11-18 18:17Z by skiminki-nv** (human dev, MEMBER; self-assigned, label
  `Test Intermittency`). Not our bot's filing → normal R6 dispatch.
- **Triager dispatched 11-18 ~18:2xZ** by this Main session (sess-1795025830070-1exigo)
  on `gh-issue-shader-slang/slang-14604` with `<github-post-authorized />`;
  👀 reaction posted (id 667602997). No pre-existing owner session; no open PR
  referencing the issue at dispatch time.
- Substance: `EndToEndCompileRequest::executeActionsInner`
  (`slang-end-to-end-request.cpp:236`) parses/checks the `-specialize <Type>` argument
  without setting the thread-local current AST builder, so `Val::resolve` creates nodes
  with whatever builder an earlier same-thread compilation left behind. Cross-session
  builder → debug assert `slang-ast-builder.cpp(468)`; release builds silently create
  nodes outside the linkage's builder hierarchy. Makes
  `tests/spirv/generic-entrypoint-specialization-capabilities.slang` order-dependent
  (fails after `tests/serialization/std-lib-serialize.slang`, which creates its own
  global session) — intermittent in full debug slang-test runs.
- Reporter's proposed fix: `SLANG_AST_BUILDER_RAII(getLinkage()->getASTBuilder());`
  at the start of the `m_passThrough == PassThroughMode::None` block in
  `executeActionsInner`, around `createSpecializedGlobalComponentType` /
  `createSpecializedGlobalAndEntryPointsComponentType`. Issue also flags that other
  semantic-checking entry points outside an AST-builder scope may share the defect.
- Reproducer: `slang-test tests/serialization/std-lib-serialize.slang
  tests/spirv/generic-entrypoint-specialization-capabilities.slang` (debug build).
- **Triage [Report] received + Main-verified 11-18 18:37-18:40Z** (triager sess dvzixo):
  bug / high / P2 / frontend, `reproduced` label applied 18:36:41Z (nv-slang-bot event-verified);
  triage comment 6988003103 posted 18:38:44Z. Reporter's root-cause analysis verified end-to-end on
  master 4a1d62c5b + reproduced on fresh Debug build (8/12, subtests .1/.3/.5/.7 assert; control 8/8).
  Not a dup of #13538 — distinct unguarded path (PR #9245/#9685 guards don't cover it). Recommended
  fix: A + Module guard (`SLANG_AST_BUILDER_RAII` in executeActionsInner end-to-end-request.cpp:229-239
  + Module::_validateSpecializationArgsImpl :3625); sibling unguarded paths enumerated
  (parseSpecializationArgStrings :4161, _extractSpecializationArgs :3823, specialize linkable.cpp:427;
  reflection-chain spReflection_specializeType/isSubType latent-only, deferred as follow-up).
- **Fixer handoff delivered 18:38Z** — slang-fixer session sess-1795027094066-6xrbq9 live and running
  on the canonical thread since 18:38 (Main-verified in sessions list).
- **Triage memo archived**: [raw/triage-14604.md](raw/triage-14604.md) (full evidence + sibling-defect
  survey; Module::_validateSpecializationArgsImpl :3625 = the one HIGH unguarded twin).
- **Fixer [Report] 19:15Z, Main-verified**: **draft PR #14605** "Establish the AST-builder scope when
  checking -specialize arguments" (head `856b1636`, branch fix/issue-14604, 2 files +9/−0:
  slang-check-shader.cpp + slang-end-to-end-request.cpp = the two guards; label `pr: non-breaking`;
  pr-mapping wired → fixer session 6xrbq9). Repro pair-command 8/12 pre-fix → 12/12 post-fix; spec-alone
  8/8, serialization 18/18, targeted -specialize+front-end 90/90; critique gates 3×approve. Explanation
  comment 6988741372 (19:09:39Z). slang-reviewer session 8jblk9 live on the thread since 19:15.
  Follow-up owed: deferred reflection-chain guards (spReflection_specializeType → Linkage::specializeType
  :4210, ComponentType::isSubType linkable.cpp:1230) — latent, no failing test, need maintainer tracking.
- **#13538 family claim — verified nuance (fixer's ⚠ correction was mostly wrong; corrected with
  receipts 19:5xZ, msg id 55; fixer ACCEPTED 19:18Z and closed it out)**: the triager's "same defect family as #13538" is CORRECT — our own
  #13538 fix-PR chain (head 8f894f0) round-5 review found the same defect class (specialize-path code
  outside an AST-builder RAII scope; null builder on a worker thread via `getTrailingUnsizedArrayElement`;
  learning 1792060186315: "Found on #13538 round 5"). Live #13538 issue = E31215 unsized-arrays diagnostic.
  In-tree twin-guard precedent = PR #9245 (verified in diff; the triager's public comment 6988003103
  already cites it precisely: "sibling of #13538 — there a null builder on a worker thread; here a stale
  builder on a reused thread"). The wiki concept page
  (slang-compiler-api-ownership-and-frontend-guards.md) is accurate — do NOT "fix" it.
- **Maintainer approval 11-18 19:47Z (Main-verified)**: skiminki-nv (issue author) APPROVED PR #14605
  (review 5963842760, "LGTM"); head unchanged `856b1636`; PR flipped ready by a human (not us) —
  normal CI queued. Fixer ack comment 6989652772 posted. No open review threads. Still awaiting
  slang-reviewer peer verdict → [Fix Report] follows; merge is human-owned.
- **[Fix Report] 11-18 20:37Z, Main-verified → CHAIN TERMINAL ON OUR SIDE**: fix complete per the
  report — 2 guards (+9/−0): `executeActionsInner` end-to-end-request.cpp:236 (maintainer's prescribed
  fix) + `Module::_validateSpecializationArgsImpl` slang-check-shader.cpp:3631. Peer review
  APPROVE_WITH_NITS (0 bugs; 1 gap maintainer-accepted as follow-up: two-session unit test — reviewer
  empirically refuted "no CI-runnable test", deterministic repro at reviewer's
  runs/drill-14605/two-sessions-specialize.cpp, enforced by debug static-unit-test CI; clarity nits
  C001/C002). Repro 8/12→12/12 (reviewer-lead independently reproduced base+head); serialization 18/18;
  -specialize+FE 90/90. Maintainer skiminki-nv APPROVED (LGTM, 5963842760); PR ready (human flip);
  CI green so far on head `856b1636` (no failed checks; many skipping from the yielded manual dispatch).
  Resumable state posted: issue cmt 6990881573 (20:35:50, "fix ready for merge"). **Awaiting human merge
  of PR #14605.**
- **Open follow-ups (operator's call — new fixer chains gate on operator)**:
  1. Unit-test PR (two-sessions determinism test + C001/C002 nits) — reviewer recommends; maintainer
     accepted the head without it.
  2. Deferred guard paths: reflection-chain side find **FILED 11-18 ~20:4xZ as our own #14611** by the
     triager (dedup-before-filing held; static-only, no repro, honestly graded, `#14611` parked for
     maintainer direction with a 11-25 one-shot re-check — see
     [14611-reflection-specializetype-no-ast-builder-scope.md](14611-reflection-specializetype-no-ast-builder-scope.md);
     its issue_opened = self-echo, no dispatch); `ComponentType::isSubType` (linkable.cpp:1230) remains
     the unfiled latent twin, folded into the #14611 follow-up scope.
- **Maintainer full-suite confirmation 11-19 08:42Z (Main-verified)**: skiminki-nv on PR #14605 —
  "Local full test runs without and with this PR confirm that the test retries go away" (cmt 7004151812;
  fixer replied 7004178860). Strongest regression evidence yet; chain otherwise unchanged — PR
  maintainer-approved, awaiting human merge.
- **Maintainer-requested master sync done 11-19 09:11Z (Main-verified)**: skiminki-nv asked
  "@nv-slang-bot Please sync the PR with master." (cmt 7004187932); fixer merged origin/master
  (a4d69f877) into fix/issue-14604 as merge commit **`c0188daeb`** — no rebase, no force-push, approved
  commit `856b1636` preserved as first parent; PR MERGEABLE (pre-sync CONFLICTING resolved); skiminki-nv
  **re-APPROVED the synced head 08:57:27Z** (original approval auto-dismissed by the push, as expected);
  both guards intact at post-reorg paths (master #14514 moved slang-check-shader.cpp into
  semantic-checking/ — Module guard now lives at semantic-checking/slang-check-shader.cpp); acceptance
  re-run green at the merged head (12/12 pair, 8/8 spec-alone, 18/18 serialization, 90/90 targeted);
  diff vs master unchanged (2 files +9). TODO closed (7004290747), explanation comment refreshed for the
  new head. CI re-triggered by the synchronize push — results via webhook.
- Resume on: PR #14605 merge webhook (fixer session owns pr-mapping), human comment, or the triager's
  side-find disposition.
