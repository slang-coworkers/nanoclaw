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

**skiminki-nv ANSWERED 11-19 ~17:0xZ (issuecomment-7036444972):** GLSL mode should follow the GLSL
specification (endorses the GLSL-mode divergence; cautions it's potentially a big breaking change);
Slang mode stays per his Remark 2. **Contingency NOT triggered.** Concrete ask to the bot: dedicated
Slang-mode declaration-ordering test file `tests/language-feature/types/multidimensional-array-declarations.slang`
— getCount() at every level for `int[2][3] a;`, `int b[2][3];`, `int[2][3] arr[5][4];` (≡ `int[2][3][4][5] arr;`).
Dispatched to the fixer; triager to post the issue-thread ack once landed. Both maintainers now
aligned with the GLSL-gated approach.

**11-20 10:18Z — skiminki test landed: head fdb8f56b5** (his exact two bullets, Slang mode,
`tests/language-feature/types/multidimensional-array-declarations.slang`; verified passing on
pristine master AND branch — no new finding; language-feature 2740/2740, GLSL 380/380). **skiminki-nv
flipped the label to `pr: breaking change` himself** (release-note visibility: GLSL-imported sources
may carry reversed-order workarounds) — label item closed by the maintainer, not us. He mused about a
commandline switch preserving legacy ordering; fixer replied same-turn on the PR (7036760610):
implementable but contradicts the GLSL spec / glslc; offered migration diagnostic as cheaper
alternative + switch prototype on request — open for humans, no action unless tasked. Explanation
comment + PR description carry his test attribution, breaking label + rationale, GLSL breaking-scope
assessment. CI run 44715070595 pending. Issue-thread ack posted by the triager (7037040785,
verified live 11-20 10:19Z: refs PR + test file, no mentions) — his ask closed on the issue.
**11-20 10:5xZ — test collision with skiminki-nv:** he forgot the bot implements in real time and
added his own test in **PR #14659** ("Add test for multidimensional array declaration ordering",
extends `tests/language-feature/types/multidimensional-array.slang`, non-draft, open). Direct
@nv-slang-bot ask (issuecomment-7037582457): remove our test OR amend his after merge; he'll notify
on merge. **Decision (mine): option 1 — remove our `multidimensional-array-declarations.slang`**,
defer to his canonical coverage; on his merge-notification, fold master and verify HIS test passes
on our GLSL-gated branch (protective value transfers to his file). Fixer removing test incrementally;
triager posting the choice ack on the issue (7037621711, verified live 11-20 10:49Z: "Going with
option 1", fold-in commitment). **Option 1 executed 11-20 11:01Z: removal commit 711a32661** —
our `multidimensional-array-declarations.slang` deleted (commit cites his request + #14659);
net diff vs master back to 2 GLSL-gated source files + `tests/glsl/array-nested-type-5870.slang`
(verified live: head 711a3266, 3 files, +141/−3, draft). Surfaces refreshed; explanation comment
+ PR description cite #14659 as the Slang-mode coverage. **Fixer holding for #14659's merge
notification → fold master + run his test against the GLSL-gated build (any failure = report at
once as real regression).**

**Chain parked on: CI verdict (→fixer webhook), maintainer review of the draft, skiminki-nv's
legacy-ordering switch question (humans', no action unless tasked), and the #14659 merge
notification (fold master + run his test on our branch).**

**11-20 ~10:45Z — skiminki-nv also opened standalone test PR #14659** ('Add test for multidimensional
array declaration ordering', branch slang-issue-5870-multidim-arrays, created 10:33:02Z, head
993afe1f, `pr: non-breaking` + Test Coverage, +61/-0 new tests/language-feature/types/multidimensional-array.slang,
COMPARE_COMPUTE targets=all). Body: complements #5870 but does NOT address it (Slang-mode ordering pin
across type-suffix / C-style / var / combined-suffix forms; GLSL out of scope). NOTE: this overlaps
his own 10:18Z test commit fdb8f56b5 in our draft #14619 (multidimensional-array-declarations.slang
still in #14619's file list at 10:45Z) — if #14659 merges first, the chain should propose dropping the
test commit from #14619 to avoid two near-identical test files. Approver side: slang-pr-approver is
paused, so #14659 is queued NOT-FORWARDED in data/approver-pause-queue.md (first event, entry carries
the overlap note); no action owed by the fixer on #14659 itself.

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
