---
type: chain
title: slang#13902 — WGSL static const arrays as var<private> exceed the 8192-byte private limit
description: Human-filed (albertrodriguezclo, external) 2026-10-25 06:59Z with own fix PR #13903 opened 45 s later. Held, nothing dispatched or posted. #13903 breaks a CHECK line in bot draft #13669 (#13658) if it lands first.
tags: [wgsl, emit, webkit, safari, community-pr, held]
---

# slang#13902 — WGSL `static const` arrays emitted as `var<private>` exceed the private limit

**2026-10-25 06:59:40Z `issue_opened`.** Main webhook session `sess-1792911582126-uuisgq` (the only session
on `gh-issue-shader-slang/slang-13902`). Live read: open, 0 comments, no labels, no assignee.

**Ownership.** Timeline `cross-referenced` from **PR #13903** (`fix/wgsl-const-arrays`, "Fixes #13902"), opened
by the reporter at 07:00:24Z, not a draft. Assignees jkwak-work + reporter; review requested from dshreiner-nv.
It changes `slang-emit-wgsl.cpp` `emitVarKeywordImpl` (new `isWGSLConstExpression`; module-scope `static const`
arrays become WGSL `const`, `var<private>` only when the value reads an `override`/variable), the WGSL user-guide
page, and three `tests/wgsl/static-const-array-*.slang` tests.

**Disposition: held, nothing dispatched or posted** — same as #13845/#13846 (this reporter files with their own
PR; triage or a bot fix would duplicate it; R6 #13596 bot-waits-on-human-issues).

**Interaction with our chain (#13635 cluster, [13635-wgsl-nonfinite-const-expr-cluster.md](13635-wgsl-nonfinite-const-expr-cluster.md)).**
Bot draft **#13669** (#13658, head `f70ea437da`, operator-held) adds `tests/wgsl/static-const-array-non-finite.slang`
with `// WGSL: var<private> kFinite{{.*}} = array<f32, i32(3)>( 1.0f, 2.0f, 3.0f );`. Under #13903 an all-finite
table is emitted as `const`, so that CHECK breaks for whichever PR merges second. Both edit `slang-emit-wgsl.cpp`.
Not sent to the #13669 owner yet (#13903 unmerged, #13669 parked on operator un-draft).

**Resume on:** a maintainer/bot mention on #13902/#13903; #13903 merging (→ tell the #13669 owner, on
`gh-issue-shader-slang/slang-13658`, to merge master and update the `kFinite` CHECK to `const`); or an operator ask.
