---
type: project
title: "slang#5667 — metal: re-enable Metal render tests (PR #14666)"
description: Maintainer-directed chain — jhelferty-nv asked if still an issue, then requested a PR re-enabling the -mtl render tests; fixer PR #14666 in flight
tags: [slang, metal, maintainer-requested, render-tests]
---

# slang#5667 — metal: Investigate rendering tests → PR #14666

## Chain

1. **11-18 20:47Z** — jhelferty-nv (issue assignee) @nv-slang-bot: "Is this still an issue?"
   → routed to slang-triager (sess-1795034954305-9x8dx7, canonical thread
   `gh-issue-shader-slang/slang-5667`). Verdict posted 20:56Z
   (cmt 6991407588): compiler-side FIXED at master (render0.hlsl compiles clean
   for Metal; unmerged PR #5666's fix landed via #6063,
   slang-ir-legalize-varying-params.cpp:3339), but the three -mtl render tests
   were never re-enabled (DISABLE_TEST -mtl + (mtl) entries in
   expected-failure-github.txt). Issue left OPEN (close is maintainer-only).
   No `reproduced` label — no Metal runtime on Linux host.
2. **11-20 15:56Z** — jhelferty-nv: "Please make a PR reenabling the tests so we
   can check if it's fixed via CI" (cmt 7044053445) → slang-fixer dispatched
   fresh (sess-1795190231482-uplj97, canonical thread) with triage findings as
   fix brief. Scope: remove DISABLE_TEST -mtl from render0.hlsl:4,
   multiple-stage-io-locations.slang, nointerpolation.hlsl + drop matching
   expected-failure entries; CI (macOS Metal runner) is the validation path.
 3. **11-20 16:31Z** — **Draft PR #14666 open** @ head `a1def38`, label
    `pr: non-breaking`, CI run 44773191612 triggered; issue status comment
    posted; explanation HTML on PR (inbox
    a2a-1795192282427-9z9clq); peer review dispatched to slang-reviewer;
    [Fix Report] pending reviewer verdict. PR mapping → fixer session
    (verified in pr-mappings, 16:25Z).
 4. **11-20 17:33Z** — **[Fix Report] received: TERMINAL our side.** Head
    `72fedaf6b` (2 commits, 5+1 files, +1/−11): deletes the three `-mtl`
    DISABLE_TEST rows + 2 stale TODOs, three `(mtl)` expected-failure-github.txt
    rows, 2 stale disabled-tests.txt rows; commit 2 tags nointerpolation.hlsl
    with `render` category (review nit). No compiler code. Local: metal compile
    6/6, render tests 4/4 (mtl rows skipped on Linux by design — no Linux CI
    risk). Review: APPROVE_WITH_NITS, 0 bugs (3 reviewers clean), nits applied;
    one declined with justification (TODO for remaining -llvm/-vk/-cpu disables
    would record a guess). Explanation cmt 7044748169; issue status cmt
    7044832921.

 5. **11-20 18:16Z** — maintainer follow-up answered (cmt 7047183618, OUTPUT_REVIEW
    caught one mis-attribution pre-post): the disables came from four separate
    causes, none capacity — whole-file disable tangent-vector #1760 (Mar 2021,
    render-test refactor); `-mtl` rows aleino #5623 (Nov 2024, Metal comparison
    failed → he filed #5667/#5666); `-llvm` ikkala #8960 (Dec 2025, LLVM IR
    target); `-vk`/`-cpu` jkwak-work #14561 (harness migration preserving the
    2018 "most Vulkan copies failed" exclusion).

 6. **11-20 19:50Z** — **CI verdict at 72fedaf6b (mixed) → head `2f634ea81`, CI
    re-running; maintainer marked PR ready (ready-flip pending MOOT).** render0.hlsl
    + multiple-stage-io-locations.slang PASS on Metal macOS lanes — #5666/#6063
    fix confirmed end-to-end. nointerpolation.hlsl still genuinely FAILS
    (image-compare 255→0 at (512,0), flat-shading triangle boundary; baselines
    identical) → re-added as expected-failure `tests/render/nointerpolation.hlsl.4
    (mtl)` (cmt 2f634ea81) so the row keeps running. Fixer's own regression fixed:
    removing the -mtl line shifted position-based row numbering, dx12 rows slid
    .7→.6 onto missing baselines → added .6.expected.png copies (commit
    35c698a7f; `git add -f` — *.expected.png gitignored per #14561 convention).
    Verdict cmt 7049112448 (offers follow-up issue for the nointerpolation
    residual). CODE_REVIEW + OUTPUT_REVIEW approved; explanation + PR description
    refreshed for 2f634ea81.

## State (11-20 19:50Z): LIVE — CI at 2f634ea81

Ready-for-review flipped by a human (ready-flip weekly-list entry moot). Awaiting
CI at head 2f634ea81; webhooks route to fixer sess-uplj97. Open: nointerpolation
residual (kept as expected-failure; follow-up issue offered to maintainer).

Resting on maintainer ready-flip (human action, stated in issue cmt 7044832921):
draft PRs skip pull_request CI at the ci.yml filter gate, so the authoritative
full-priority CI incl. the macOS `-api mtl` lane runs only after a maintainer
marks #14666 ready. Meanwhile low-priority dispatch run 44779843117 covers the
same lanes (yielded at priority gate; `ci-retry-yielded-bot` reruns when CI is
quiet). Webhook-driven from here: PR events route to fixer sess-uplj97.
Ready-flip goes on the weekly operator list (no per-PR ask; not P0/P1).

## Follow-up candidate

- `texture2d-gather.hlsl` deliberately excluded from re-enable (compiles 2/2
  for metal) — future PR candidate if the macOS lane confirms the trio green.

## Durable facts

- The Metal render-test trio to re-enable: `tests/render/render0.hlsl` (line 4),
  `multiple-stage-io-locations.slang`, `nointerpolation.hlsl`.
- Fixer cannot ready-flip PR #14666 itself (spine) — ready-flip pending for the
  weekly operator list unless maintainer flips or asks.
