---
type: chain
title: "slang#14474 history 2/3 — draft PR #14501 and two review rounds (11-16)"
description: "11-16 13:46Z–16:04Z: draft PR #14501 opened (AbortCompilationEscape setjmp/longjmp, 7 recovery boundaries); reviewer REQUEST_CHANGES x2 (import stack, stranded lock, zombie modules); round-1 fixes at 9f8148f2d; chain RESTING at cacce89e5 with 4 documented shipped-unresolved items. Split out of [[14474-disable-exceptions-fatal-diagnostic-process-death_history.md]]; live state in [[14474-disable-exceptions-fatal-diagnostic-process-death.md]]."
tags: [slang, exceptions, no-throw-api, history]
---

# slang#14474 history 2/3: draft PR #14501 and review rounds (11-16 afternoon)

## Draft PR #14501 and review rounds (13:46Z–16:04Z)

- 13:46Z: **draft PR #14501 open** (head ce75e81e3, 4 commits, 11 files +272/−9:
  AbortCompilationEscape setjmp/longjmp mechanism in core, SLANG_EXCEPTION_TRY_RECOVERY
  macro layer, recovery installed at loadModule/loadModuleFromBlob/link/getTargetArtifact/
  compile, both-config tests; label `pr: non-breaking`, CI triggered, explanation comment
  posted, issue updated with the PR link). Pr-mapping row exists (slang-fixer
  sess-1794813961882-jk0msz → this thread). All 6 acceptance criteria met per fixer
  (no-exc repro: 255 via diagnostics, output identical to exceptions build, was SIGILL
  132; only AbortCompilation escapes; default build byte-unchanged — tests/diagnostics
  1083/1083, unit 688/688). Critique stages all approved (PLAN_REVIEW, CODE_REVIEW ×2,
  OUTPUT_REVIEW ×4). No CI lane builds SLANG_DISABLE_EXCEPTIONS (new tests cover it only
  locally) — flagged on the issue.
- 14:18Z: **reviewer verdict REQUEST_CHANGES** (combined A/B/C; full verdict sent to the
  fixer on its edge, file in my inbox
  /workspace/inbox/a2a-1794838701894-on2y80/combined-review.md). Bugs: dangling import
  stack after abort recovery (slang-session.cpp:328), locked session after fatal layout
  recovery (slang-linkable.cpp:788), failed modules remain in loaded caches
  (slang-session.cpp:479) — the longjmp destructor-skip risk family the triage flagged.
- 15:26Z: **round 1 answered at new head 9f8148f2d** (4 forward commits, no force-push):
  import-list reset in all five recovery arms; AbortRecoveryLock for the layout mutex
  (deliberate deviation from suggested double-checked locking, documented); third
  same-class bug (zombie half-compiled module in loaded-module caches) fixed via new
  reraiseAbortCompilation(); clarity comment batch + 2 suggested unit-test cases applied.
  Both-config verification green (repro 255 via diagnostics; 1083/1083 + 688/688; new
  repeat-failing-load check passes). **Round 2 dispatched (last round per policy).**
  Infra constraint (known pattern, same as #14037): bot token cannot push
  `.github/workflows/` — the requested no-exceptions CI lane is a ready-to-apply PR
  comment (cmt 6920727925) for a maintainer/workflow-capable token to apply.
- 15:43Z: **round-2 verdict REQUEST_CHANGES** (1 bug, 5 gaps; head 9f8148f2d). The 1 bug:
  a genuine stranded-lock regression inside the new recovery coverage; gaps = 2
  contract/documentation inconsistencies in the new protocol, unquantified per-abort
  leak, CI-coverage gap for the new path, 1 sizing-comment inaccuracy (core mechanism/
  macro pairing/lock-stack protocol/volatile handling all verified correct). Last
  reviewer round per policy — then the PR rests on maintainer review.
- 16:03Z: **[Fix Report] — chain RESTING on human review.** Final head cacce89e5 (10
  commits, 14 files +597/−26, master..cacce89e5): recovery at 7 boundaries (loadModule,
  loadModuleFromBlob, loadParsedModule, loadSerializedModule, link, getTargetArtifact,
  compile) + state restoration (import list, loaded-module caches, operation-mutex
  locks). Round-2 bug fixed; 4 items shipped-unresolved with documented causes:
  (1) no-exc CI lane — bot can't push `.github/workflows/` (#14037 pattern), ready-to-apply
  YAML in PR cmt 6920727925; #12782 (exceptions-disabled core, merged 09-29 by
  pdeayton-nv) is the related unblock path; (2) per-abort leak acceptance → maintainer
  sign-off; (3) loadSourceModuleImpl context divergence — needs Approach-B restructuring
  (follow-up); (4) loadSourceModuleImpl conversion declined with cause. Verification:
  repro PASS both configs (255 via diagnostics, was SIGILL 132, byte-identical output);
  1083/1083 + 688/688; CI green-triggered on final head. Worktree wt-slang-14474
  retained until the PR resolves.
- 16:04Z: triager **[Triage Resolution] CLOSED** — verified the GitHub footprint first:
  issue carries `reproduced` + Type=Bug + full comment trail (triage 6912544885 → fixer
  final state 6918339543 @ 13:51Z, which links the PR); its promised draft-PR delta
  comment was redundant → correctly not posted.
