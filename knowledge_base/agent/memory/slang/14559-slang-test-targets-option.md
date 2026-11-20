---
type: chain-record
title: slang#14559 — slang-test `targets=` option for COMPARE_COMPUTE tests
description: Feature request triaged 11-17, parked on the operator for fixer go/no-go; author jkwak-work self-assigned
---

# slang#14559 — slang-test `targets=` option for COMPARE_COMPUTE tests

- **Filed** 11-17 21:08Z by jkwak-work (core team, self-assigned — NOT a stand-down per the
  11-17 operator correction). Feature request: `targets=` option on `COMPARE_COMPUTE` /
  `COMPARE_COMPUTE_EX` / `COMPARE_RENDER_COMPUTE` / `HLSL_COMPUTE` lines; one line expands to
  one test per backend at gather time.
- **Dispatched** to slang-triager 21:10Z on canonical thread `gh-issue-shader-slang/slang-14559`
  (session sess-1794949806336-iwa977), 👀 reaction 664387979. Number-grep and session check clean
  pre-dispatch; not a bot filing (human author).
- **Triaged 21:15Z**: feature/P2/test-infra, no dup. Both proposal anchors verified on master and
  re-verified by Main locally: `_gatherTestsForFile` slang-test-main.cpp:591,
  `_parseCommandArguments` :347. Demand (triager's count): 73 test files carry near-duplicate
  per-backend COMPARE_COMPUTE* lines. Recommended approach A: gather-time expansion in
  `_gatherTestsForFile` (B = synthesized-test machinery rejected, wrong granularity; C = templating
  rejected). Key hazard handled by the proposal: option list splits on commas (:368) so
  `targets=vk,metal` arrives as `targets=vk` + bare `metal` — bare-segment continuation is the
  right handling. Full brief: [raw/triage-14559.md](raw/triage-14559.md).
- **5-bullet + 3 open micro-decisions posted** (delimiter, SPIR-V-mode variants as targets vs
  flags, `all` membership): https://github.com/shader-slang/slang/issues/14559#issuecomment-6961208634
- **PARKED on the operator for fixer go/no-go** (feature ask → fixer chain is the operator's call;
  DM'd orchestrator-dashboard 11-17 ~21:2xZ). Author is self-assigned and may implement directly —
  answers to the micro-decisions on the issue are also a live inbound for the triager.
- Re-check: triager one-shot `i14559-recheck-123b` fires **2026-11-24**. Do not re-dispatch its
  webhooks to a second chain; route to the triager session above.
