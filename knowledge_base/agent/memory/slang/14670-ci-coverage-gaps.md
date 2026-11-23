---
type: chain
title: "slang#14670 — CI: close slang-test coverage gaps (job matrix, skip-lists, disabled tests)"
description: Maintainer CI-meta issue; triaged 11-20, parked on jkwak-work's open questions; triager re-check i14670-recheck-d359
---

# slang#14670 — CI slang-test coverage gaps

- **Filed** 11-20 ~18:29Z by maintainer jkwak-work (self-assigned; labels CI, Test
  Coverage) — CI-meta tracking issue: job-matrix proposal (3 new free `-cpu` jobs,
  Windows sm80 runners), skip-list/expected-failure cleanup, ~130 misspelled
  `*DISABLED*` directives, 200 fully-disabled test files, stale-list pruning.
- **11-20 18:29Z:** 👀 posted, triager dispatched with `<github-post-authorized />`
  on canonical thread (triager sess oizqxq).
- **Triage 18:36Z:** enhancement/medium/CI/P2, not a duplicate (related: #13125,
  #10808, #11988, #10480). Headline claims verified against checkout with two
  **corrections**: skip-list-debug.txt has 23 neural entries (25 counting
  tests/bugs/neural-autodiff-*), stray prose at lines 12–13 (not 13–15); and
  **tests/disabled-tests.txt is NOT stale** — 36/37 files exist, it is the live
  registry of intentionally-disabled tests; blanket deletion would lose rationale.
- **Disposition:** parked for maintainer direction — jkwak-work must answer the 3
  open questions (Windows SM80 runner label, macOS `-metal` suffix, debug-sm80
  neural skips) and sequence Cluster A (bot-actionable repo edits) vs Cluster B
  (infra/runner work). One-shot re-check task **i14670-recheck-d359** (+7d),
  verified live in the triager's group.
- **11-20 18:4xZ discrepancy → resolved, was a RACE not a false claim:** triager's
  msg-16 report (18:36Z) pre-announced the post; my `gh api` check raced it (comment
  created 18:37:32Z, after my read) → nudge on its edge (msg 21) was unnecessary but
  harmless. Verdict landed as issuecomment-7047631095 (nv-slang-bot, Main-verified).
  Lesson: a just-claimed GitHub post warrants one delayed re-check (≥2 min) before
  nudging. Triage memo archived at [raw/triage-14670.md](raw/triage-14670.md).
  Parked chain has its resumable artifact; on maintainer go-ahead the re-check
  hands Cluster A to slang-fixer. No bot fix work before that.
