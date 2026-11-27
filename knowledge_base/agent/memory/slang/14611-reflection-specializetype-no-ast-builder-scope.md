---
type: value
title: "slang#14611 — spReflection_specializeType runs specialization with no AST-builder scope (latent, #14604 family)"
description: TERMINAL — fixed by PR #14723 (maintainer-approved, awaiting merge); latent #14604-family side-find, no repro ever claimed.
---

# slang#14611 — reflection specializeType without AST-builder RAII (#14604 family)

- **BOT-FILED 11-18 ~20:4xZ by slang-triager** (session dvzixo, relayed side-find from the PR #14605
  review chain per review policy). **Its `issue_opened` webhook = self-echo of our own filing —
  NO triage dispatch** (any sibling Main: match by this title, not number-grep — the grep false-empties
  for fresh filings).
- Substance: `spReflection_specializeType` (slang-reflection-api.cpp:5575) → `Linkage::specializeType`
  (slang-check-shader.cpp:4210) runs semantic checking with no `SLANG_AST_BUILDER_RAII` scope —
  same stale/null thread-local builder defect family as #14604 (fixed by PR #14605, MERGED 11-19
  12:29Z by skiminki-nv @ `c0188daeb`). Static defect confirmed on master; NO dynamic repro — six debug-build shapes pass
  clean (warm witness caches short-circuit `isSubtype`); the fixer retracted its original "verified repro"
  claim BEFORE filing; graded honestly (review called it question-severity); no `reproduced` label.
- Fix shape: one-line `SLANG_AST_BUILDER_RAII` at slang-check-shader.cpp:4210. Related deferred twin:
  `ComponentType::isSubType` (slang-linkable.cpp:1230).
- **PARKED for maintainer direction** — triager one-shot re-check armed 2026-11-25. No fixer chain
  (new chains gate on operator; parent #14604 chain record has the operator follow-up note).
- **Maintainer directive 11-25 18:29Z — PARK LIFTED, fixer chain dispatched**: skiminki-nv commented
  (cmt 7170973978, real @nv-slang-bot mention): "Please implement the suggested fix". Wiki-verified
  policy: explicit maintainer directive for non-gated work authorizes acting at once + reporting after
  (filing policy's fixer-chain gate is "report it", not hold-for-approval). Pre-dispatch checks
  (Main, 11-25): fix confirmed ABSENT at origin/master — #14514 refactor moved the file to
  `source/slang/semantic-checking/slang-check-shader.cpp:4212` (slang-linkable.cpp:1230 /
  slang-reflection-api.cpp:5575 unmoved); no sibling owner on the canonical thread; live comment
  re-derived byte-exact. **slang-fixer dispatched 11-25 on this canonical thread** (msg id 31) with
  `<github-post-authorized />`, scope relayed as "the suggested fix" (one-liner at the specializeType
  overload), sibling `ComponentType::isSubType` explicitly out-of-scope-undirected, #14605 unit-test
  precedent noted as context only. The triager's 11-25 one-shot recheck (recheck-14611-71b1) ran
  18:58–18:59Z: found the maintainer directive, sent its solution brief (verified current at
  slang-check-shader.cpp:4212) + triage memo to slang-fixer — routing landed it in the SAME owner
  session (created 18:32 by Main's msg-31 dispatch), no duplicate chain. Delta comment posted on
  the issue (7171659145). Recheck series complete; fixer chain `running` as of 18:59Z.
- **PR opened 11-25 ~19:0xZ (Main-verified live): draft PR #14723** "Establish AST builder scope in
  Linkage::specializeType" — branch fix/issue-14611, head `433627e`, label `pr: non-breaking`,
  state OPEN/draft. Explanation comment posted by the fixer on the PR (7171883381); explanation
  artifact archived at /workspace/inbox/a2a-1795633992232-5jcvzn/. Guard placed in the overload at
  semantic-checking/slang-check-shader.cpp:4219 (fixer's build report).
- **Maintainer ready-flip + APPROVAL 11-25 19:18:08Z (Main-verified live)**: skiminki-nv flipped
  PR #14723 to ready and APPROVED it (their own acts — the fixer did not ready-flip). MERGEABLE;
  CI triggered, pending at 19:3x. Reviewer (slang-reviewer) [Fix Review Request] in flight;
  [Fix Report] to follow. Fixer verification: debug build green, reflection 60/60, unit 728/728,
  type suites 156/156; no new test (no failing shape exists; open to revisit with reviewer).
  Issue thread updated in place (7171980825). Codex gates 3× approve.
- **Triage sub-chain closed 11-25 ~19:5xZ**: triager's late triage handoff arrived after the fixer was
  already the owner (dispatched 18:33) — no conflict; its one extra criterion (clean Release build) met
  (release exit 0, Release slang-test reflection 60/60, log reports/wt-14611-tests-reflection-release.log);
  [Triage Resolution] sent; sibling `ComponentType::isSubType` verified unguarded, left out-of-scope,
  follow-up issue suggested to the triager. CodeRabbit "review skipped" + board-sync notices = noise,
  correctly unanswered. Codex gates re-recorded post wipe: 3× approve.
- **[Fix Report] 11-25 20:21Z, Main-verified live → CHAIN TERMINAL ON OUR SIDE**: fixed — 3 commits
  +74/−0, 2 files on head `cd7f47811` (branch fix/issue-14611, PR #14723): the one-liner guard at
  semantic-checking/slang-check-shader.cpp:4223 (433627e0a) + declarative why-comment (62be36c92,
  review nit 1) + new success-path unit test `specializeTypeSuccessPath`
  (tools/slang-unit-test/unit-test-specialize-type.cpp, NoRenderApi; cd7f47811, review nit 2 — asserts
  non-null/no-diagnostics/Kind::Specialized; reviewer's guessed Struct/field-count assertions probed
  against slang-reflection-api.cpp:539/:578 and corrected). Peer review APPROVE_WITH_NITS (0 bugs,
  both nits applied same round; advisories C002/C003 declined with justification). Tests: no failing
  case exists (six clean two-session repro attempts in the issue) → success-path coverage instead:
  debug green, reflection 60/60, unit 729/729, types 156/156, Release green + reflection 60/60.
  Live-verified 20:2x: head `cd7f47811`, MERGEABLE, ready; skiminki-nv's 19:18Z approval auto-dismissed
  by the nit-push → **fresh human approval needed on cd7f47811**; CI on new head 13 pass/1 pending/
  2 skipping. Side finds (ComponentType::isSubType linkable.cpp:1230,
  spReflectionType_applySpecializations slang-reflection-api.cpp:842, slang-global-session.cpp:149
  thread-local note) routed to slang-triager by the fixer per reviewer request — dedup-before-filing;
  disposition via their chain / future issue_opened echo.
- **Maintainer re-APPROVAL 11-26 09:43:53Z (Main-verified live, review 6071766721)**: skiminki-nv
  re-APPROVED head `cd7f47811` — the fresh human approval the Fix Report flagged now exists; CI on
  that head 63 passing / 0 failing (one falcor build job pending at 09:45). Issue-thread status
  comment updated in place by the fixer. **Only the human merge of PR #14723 remains**; no further
  bot action planned.
- **CHAIN CLOSED 11-26 10:54:39Z (Main-verified live)**: PR #14723 MERGED by skiminki-nv (merge commit
  `4ba9ae2e3`, final head cd7f47811 — guard + why-comment + success-path unit test, all nits in);
  issue #14611 closed via `Fixes #14611`. Fixer worktree + sentinel removed, memory terminal.
  Full arc 11-18 filing → 11-25 maintainer directive 18:29Z → dispatch 18:33 → PR 19:0x → maintainer
  approval + ready-flip 19:18 → nits + unit test → re-approval 11-26 09:43 → merge 10:54 — ~19 months'
  worth of parked chain resolved in <17 h of maintainer direction.
- **Side-find home: issue #14726** (ComponentType::isSubType + spReflectionType_applySpecializations +
  TLS note) — triager-filed, parked with the triager, no fixer chain; its `issue_opened` echo (if any)
  = self-echo of our own filing, NO dispatch — same disposition as this issue's was (see
  [filing policy](../orchestrator/filing-verified-issues-policy.md)).
- **[Triage Resolution] 11-25 20:00Z (recheck task session)**: triager confirmed chain closed — PR #14723
  ready-for-review, maintainer-approved, `Fixes #14611` (issue post suppressed per resumable-artifact
  rule). Recheck task series recheck-14611-71b1 complete. **Side-finding twin filed as #14726**
  (`ComponentType::isSubType`, slang-linkable.cpp:1230, Type=Bug, no reproducer) — Main-verified open,
  bot-filed; parked for maintainer direction, one-shot re-check armed 2026-11-27, NO fixer chain; its
  `issue_opened` = self-echo, no dispatch. Remaining human action: merge decision on PR #14723.
  **Folded 20:23Z (triager, from PR #14723 review side-find): #14726 retitled/rebody'd to cover
  BOTH sites** — `ComponentType::isSubType` (slang-linkable.cpp:1230) + `spReflectionType_applySpecializations`
  (slang-reflection-api.cpp:842, the unguarded sibling among three guarded `spReflection*_applySpecializations`);
  session-destruction thread-local mechanism (slang-global-session.cpp:149-150) recorded as contributing.
  Main-verified live 20:2xZ. One hardening PR planned if directed; recheck 2026-11-27 stands.
