---
type: chain
title: "slang#14614 — slang-test silently skips unrecognized //TEST-style directives → PR #14702"
description: Bot-filed residual of #8050; maintainer jhelferty-nv requested the fix PR 11-23; fix shipped, parked on human un-draft/review
---

# slang#14614 → draft PR #14702 (near-miss directive check)

- Origin: our own bot-filed Terminal filing from the #8050 chain (filed 11-18, low/P3, labels Testing+reproduced). Its
  `issue_opened` was self-echo (no dispatch). Chain record: [8050](8050-autoformatter-silently-ignores-tests.md).
- **2026-11-23 18:19Z** maintainer **jhelferty-nv** asked (cmt 7109993582): "@nv-slang-bot can you make a PR fixing
  this?" — dispatched slang-fixer on the canonical thread with post authorization.
- **Fix (fixer, all critique gates approved):** near-miss (insertion/deletion/transposition, substitutions excluded —
  NEST is a live corpus counterexample) directive check in the formerly-silent unknown-command branch of
  `_gatherTestsForFile`, failing the file with a did-you-mean RunError. `StringUtil::isNearMissSpelling` (core) +
  unit tests; `TestDirectiveUtil` extracted (review r1) + pinning unit test; `DISABLE_TEST_CATEGORY` covered
  (strip-interplay); 96 misspelled directive lines renamed across 49 test files (behavior-preserving: stay disabled,
  now counted ignored) — verified load-bearing by the reviewer's independent scan (96/96 renamed lines fire the check,
  0 false positives across ~6,895 files). No committed e2e near-miss test file — structurally impossible (would
  permanently fail the suite; same call as #14411); compensated by documented repro + ten-case mutation drill.
- **PR #14702** (draft, `pr: non-breaking`, head **90c605e61**, 6 commits, no force-push; branch `fix/issue-14614`).
  One mid-chain compile fix: `UnownedStringSlice::fromLiteral(const char*&)` doesn't deduce — table stores slice
  literals instead. Explanation comment cmt 7111888302; issue-thread 5-bullet cmt 7111919954 (edited in place).
- **Review r1 (three reviewers, APPROVE_WITH_NITS, head 5d37db584 → all nits applied at 90c605e61, no round 2):**
  0 bugs; top gaps fixed (table/comment sync, DISABLE_TEST_* pre/post-strip interplay, suggestion guard). PR-body
  format tension (house 4-section ≤1,000 chars vs upstream 5-part) resolved per standing precedent: keep house
  format, five-part content lives in the explanation comment (#13480 R3-N2, #14071/#14256). The body
  measured 1,127 chars after the r1 refresh — over the 1,000-char house gate; **fixed same day, 972
  chars** (fixer report 21:30Z).
- **Tests:** unit 729/729; full suite 16289/16302 (13 fails = pre-existing fp8/substandard-fp cluster), 0 near-miss
  errors corpus-wide. CI run 45266301691 (skips while draft — un-drafting is the human step that produces CI evidence).
- **PARKED (11-23, supervisor-state register):** awaiting maintainer un-draft + review. Un-draft on the weekly
  undraft list (P3). Webhook-driven follow-up lives in the fixer session (pr-mapping row exists).
- Learning captured 11-23: fixer chains dispatch their own peer review; Main must not double-dispatch the reviewer.
