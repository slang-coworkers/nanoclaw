---
type: chain
title: "slang#5870 — nested array type-expression brackets reversed vs declarations (draft PR #14619)"
description: Maintainer-requested triage (jhelferty-nv) confirmed live on master 11-18; fixer draft PR #14619 in review.
tags: [slang, chain, arrays, parser, glsl]
---

# slang#5870 — chained array-type brackets nest reversed in type-expression position

Human-filed (old, `Backlog`). **11-18 20:55Z** maintainer jhelferty-nv asked the bot to triage
(comment 6991382196) → routed to slang-triager.

**Triage (msg 12, triager):** still reproduces on master 4a1d62c5b — GLSL nested array constructors
`int[2][4](...)` fail E33070+E30019 on `-target glsl` and `-target spirv` alike (frontend, not the
GLSL emitter). Root cause: type-expression position nests `int[x][y]` first-bracket-innermost
(`Array<Array<int,x>,y>`), reversed vs declaration position (`UnwrapDeclarator`). Fix approach A:
align expression-position nesting with declarations at slang-check-expr.cpp:3647-3683 +
slang-parser.cpp:3237-3283. Triage comment: issuecomment-6991682128; added `reproduced` label.
Go-ahead decision (mine): fixer chain runs — maintainer engaged the bot directly.

**Fix:** slang-fixer draft **PR #14619** (branch fix/issue-5870, `pr: non-breaking`, explanation
comment posted, refreshed per head). pr-mappings row present (session
sess-1795036065974-jwwqda). jhelferty-nv auto-assigned shepherd by the PR-board bot.
**Terminal-on-our-side 11-19 02:17Z:** [Fix Report] — **fixed**. Head **95bffb950**, 8 files
+335/−23, 7 commits. Review APPROVE_WITH_NITS after 2 rounds (round 1: 0 bugs, all applied; round 2:
1 gap + 3 clarity, all applied; Devin's transposed-reflection "bug" = pre-existing printer convention).
Suites green at final head (language-feature 2743/2743, diagnostics 1092/1092, legalization 8/8,
autodiff 1030/1030); full suite 12366/12369 = 3 known fp8-cuda PTX infra only. Repro test PASS
(was E33070+E30019). Open human decision flagged on-PR: `pr: non-breaking` kept vs treating the
silent re-interpretation of non-square type-position spellings as breaking — for shepherd
jhelferty-nv. **Held in draft pending maintainer review; ready-flip → weekly list.** Issue-thread
PR link closed: [Triage Resolution] posted by triager as reply to the request comment
(issuecomment-6997684981, verified live 11-19 02:19Z, references #14619). **Chain parked on human
action — remaining automation webhook-driven; supervise-tick walks this record.**

**Baseline facts (A/B-verified 11-18):** full suite on this L40S = 12366/12369; the only failures are
the 3 known `tests/cooperative-matrix/fp8-cuda*.slang` CUDA_ERROR_INVALID_PTX 218 infra failures
(see shared learning 1792691640286). The 2 diagnostics tests (`array-of-unbounded-arrays`,
`unbounded-array-nonaddressable`) pass on pristine master AND on the patch — an earlier 5-failure
"baseline" report was actually an intermediate patch iteration with a since-removed bail; final
patch preserves master declarator semantics byte-identically. Gate green: language-feature 2742/2742,
legalization 8/8, autodiff 1030/1030, repro test 4/4.

**SPEC CONTRADICTION 11-19 (verifier-confirmed by me at source):** jhelferty-nv's local agent was
right — PR #14619 contradicts current normative spec text. shader-slang/spec `specification/types-array.md`
(origin/main 5f24f2e): group (2) makes `ElementType[M][N]` = N-element array of M-element arrays
(**last-bracket-outermost**), Remark 3 pins ≡ `std::array<std::array<E,N>,M>`, Remark 2 pins the mixed
spelling — **master already conforms; the PR is a semantics CHANGE, not a conformance fix.** Spec text
authored by skiminki-nv (slang PR #9560, 2026-01-14; moved to spec repo Oct 2026) — newer and
normative vs csyonghe's Dec-2024 comment, which our §4 label rationale wrongly relied on (fixer
self-corrected its [Fix Report]). Fixer did offline spec verification, no posting, analysis ready.
**State: PR held in draft, no pushes; authorized to post the spec analysis + corrected rationale on
the PR thread only (never the issue — jhelferty-nv's question there is human-to-human); reframe
(keep declaration-side fixes, drop type-position re-reading) vs ship-with-spec-amendment is
**MAINTAINER RULING 11-19 15:24Z (jhelferty-nv, MEMBER, PR review comment r4630869192):** GLSL-style
syntax must be restricted to GLSL mode; slang/hlsl spec behavior must not change — independently
confirming the spec contradiction. Fixer replied same-turn (r4631505740, spec text cited, agreed
both counts) and holds a PLAN_REVIEW-approved rework: gate checker re-nest on GLSL source language,
REVERT parser-side UnwrapDeclarator splice (slang/hlsl byte-identical to master by construction),
literate comment style, revert reversed-era test respells + move #5870 coverage to `-lang glsl`,
stride test flipped to master expectations + GLSL variant. **Rework in progress (incremental commits,
no force-push, own CODE_REVIEW before push). Contingency: pause before push if skiminki-nv's issue
answer contradicts even the GLSL-mode divergence → back to jhelferty-nv.** Sequencing call made:
PROCEED (direction explicit and actionable).

**Rework LANDED 11-19 16:57Z: head b12e4b6e4** (verified live: draft, 3 files, +141/−3). Both sites
GLSL-gated (checker on isGLSLSourceLanguage, parser splice on SourceLanguage::GLSL) — plan deviation:
parser splice stays GLSL-only, not fully reverted (reverting it transposes GLSL-mode C-style decls —
empirically verified). Slang/hlsl byte-identical to master by construction (else branch = master
verbatim); non-GLSL suites identical to master baseline; GLSL suites green (glsl+intrinsic 380/380);
new test tests/glsl/array-nested-type-5870.slang. PR description + explanation comment rewritten to
GLSL-only framing. **CI run 44570941916 pending (verdict → fixer via webhook). Contingency armed on
skiminki-nv's issue answer.** Issue thread accurate: triager's fresh status-delta comment
7016027647 (verified live 16:58Z, refs PR, no mentions) supersedes the withdrawn-plan resolution
6997684981. All surfaces now describe the GLSL-mode-only iteration; awaiting CI verdict + skiminki-nv.

**State:** parked on human spec adjudication — issue-thread PR link closed: [Triage Resolution] posted
by triager as reply to the request comment (issuecomment-6997684981, verified live 11-19 02:19Z,
references #14619). Remaining automation webhook-driven; supervise-tick walks this record.
