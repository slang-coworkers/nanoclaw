---
type: chain
title: slang#14278 — WGSL `static const` from a spec constant hangs slangc (unbounded memory growth)
description: Bot-filed side finding of the #14238 / PR #14267 chain (11-03 23:26Z); re-triaged 23:54Z as a P1 REGRESSION since v2026.7. Do NOT dispatch its issue_opened webhook. Fixer chain on gh-issue-shader-slang/slang-14278; ready-flip = one direct operator ask.
tags: [wgsl, specialization-constant, static-const, hang, side-finding]
---

# slang#14278: WGSL `static const` from a spec constant hangs slangc

⚠️ **Its `issue_opened` webhook belongs to the [#14238 chain](14238-int-div-forceinline-global-const-regression.md),
so do not dispatch it.** The Main session minted for it (`sess-1793748405249-v9w13o`) must send nothing.

The #14267 peer reviewer found it (pre-existing, not caused by #14267). slang-triager (task session
`sess-1793667544858-o8dnsv`) reproduced and filed it 23:26Z: type Bug, `reproduced`, no @-mentions. It fails the same
way on master `f1cd35ff8` and v2026.13.1, so it is not a regression. Symptom: slangc hangs and memory grows ~250 MB/s
without limit. Triager suggests P2.

**11-03 23:3xZ: fixer chain STARTED by Main** (fleet had 9 fixer sessions running; a compiler hang outranks the other
two). Route: triager `[Triage handoff]` → slang-fixer on `gh-issue-shader-slang/slang-14278`, draft PR on master.
Reported to the operator (dashboard) with a stop option.

**11-03 23:54Z, triage (triager row 44; memo was `/workspace/inbox/a2a-1793750078557-y59tsy/triage-14278.md`).**
Re-classified as **regression / high / IR / P1**: v2026.5.2 compiles it, and v2026.7 through master hang. The triager added
`regression` (its own filing). Cause (5/5 ptrace samples + code read): `legalizeIRForWGSL` → `inlineInst`
(slang-ir-legalize-global-values.cpp:192). Cloning the SpecConst-rate `add(64, N)` dedups (`_createInst` /
`_findOrEmitHoistableInst`) back to the module-scope `k`. `inlineInst` then clones `k`'s decorations into `k` while it
iterates them, so the loop never ends. `cloneInst` already guards this (slang-ir-clone.cpp:426-433). Suspected origin:
f09c7e8f4 (#10694, first in v2026.7), checked at release level only, not bisected. Plan: A, a WGSL
`isLegalGlobalInstForTarget` SpecConst exemption (slang-ir-wgsl-legalize.cpp:203, mirroring SPIR-V
slang-ir-spirv-legalize.cpp:2057-2065), plus B, a self-dedup guard in `inlineInst`. Handed to slang-fixer.
**My reply 23:5xZ:** not on the weekly list; the ready-flip goes triager → me → one operator ask (regression exception).
B stays only if a test fails without it when A is in place; otherwise use an assertion. Cite #10694 only after a bisect.
The dashboard table I sent at 23:3xZ still says P2. I did not send a correction row; the ready-flip ask will carry P1.
**11-04 01:10Z: draft PR #14285 OPEN** (I verified it: draft, head `7c1931f1b`, `fix/issue-14278`, `pr: non-breaking`. The
pr-mapping points to fixer `sess-1793750094520-hghi4m`.) The issue 5-bullet 6618565570 now says "fix in draft PR #14285,
held". Fixer-reported, not reproduced: with A, all variants compile in under 0.4 s and the output matches v2026.5.2. B
became an assertion, which fires in 0.3 s without A and has not fired in a full Debug suite. 2 cascades are fixed in the
same PR: `{k, 3}` emitted a WGSL `const` over an `override` (this shape also hangs on v2026.7), and `(N << 1) + 3` gained
`var` temporaries. Next: peer review → [Fix Report] → ready-flip via the triager → one operator ask.
**11-04 03:17Z: ready-flip question** (triager row 56; fixer [Fix Report] msg 78). #14285 head `9158ec2b0`, 13 commits,
8 files +233/−12. R1 REQUEST_CHANGES (a swizzled store gave a `const` over an `override`; fixed), R2 APPROVE_WITH_NITS
(nits applied). Scope widened, and the reviewer agreed: rule A is in the shared base `isLegalGlobalInst` for all targets,
and SPIR-V's copy is removed. B is `SLANG_RELEASE_ASSERT(result != inst)`. Tint/WebGPU rows have not run anywhere,
because CI keeps yielding to human-priority runs.
**03:2xZ: ONE direct operator ask** (dashboard): "flip 14285" / "hold 14285", and I recommended (a) flip now. No re-ask;
unanswered → weekly list. Triager told: no `gh pr ready` until I relay an answer. 3 out-of-scope finds go under the
side-finding rule, filed-only (E31226 for `{N, 3}`; `replaceOperand` does not re-key rate-hoisted insts;
`shouldInlineInstImpl` ancestor loop looks up `inst`).

**11-04 04:3xZ:** asked the #14285 fixer to check overlap with parked bot draft #13816 (`isStaticConst` const-over-override in slang-emit-wgsl.cpp) and to add a plain note to the description if they overlap.
**11-04 04:37Z:** overlap with #13816 confirmed: the same `isStaticConst` early return, in adjacent hunks, so the PR that lands second gets a merge conflict. #14285's description cites it (still a draft at `9158ec2b0`).
