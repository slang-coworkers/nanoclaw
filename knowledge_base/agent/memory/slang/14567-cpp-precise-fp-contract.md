---
type: chain
title: slang#14567 — C++ target `-fp-mode precise` leaves no trace in emitted source → downstream FMA contraction
description: Human-filed (albertrodriguezclo, same reporter as #14036) 11-17/18; cpp sibling of #14036 (CUDA, draft PR #14396) and #13689 (Metal). Triaged feature/medium/P2 (cpp emit + slang-llvm) and REPRODUCED by slang-triager 11-18; handed to slang-fixer same night (approach A+B in one PR). Judgment call: fixer dispatch rests on an extended reading of tangent-vector's 11-06 #14036 direction ("the general -fp-mode precise case").
tags: [cpp, cpu, precise, fp-mode, fma, fp-contract, feature-request, slang-llvm]
resource: raw/triage-14567.md
---

# slang#14567 — C++ target: `-fp-mode precise` → no contraction trace in emitted C++

**Ask.** On `-target cpp`, `-fp-mode precise` leaves no trace in the generated source, so the
application's own Clang/GCC is free to contract `a*b+c` into an FMA (Clang `-ffp-contract=on`,
GCC `-ffp-contract=fast` in GNU mode; x86-64 with FMA3, every AArch64). Also names a slang-llvm
gap: `host-callable` Clang invocation sets `FastMath` for Fast but never sets the contraction mode
for Precise. Expected: emitted source asks for no contraction in precise mode, as SPIR-V does with
`NoContraction`. Reporter verified on 2026.16.1 + master `e06dc840a` (clang-cl /O2 /arch:AVX2
fuses; SSE2 does not). C++ counterpart of #14036 (CUDA); same reporter.

**Dispatch 11-18 00:1xZ (me).** issue_opened webhook; live-verified open/0 comments/no labels;
grep had no 14567 hits; 👀 reaction 664919039 posted; triager dispatched on canonical thread
`gh-issue-shader-slang/slang-14567` with `<github-post-authorized />` and cross-chain context
(14036 CUDA record + 13689 Metal). jkwak-work appears as assignee shortly after (shepherd-routing
pattern, not a stand-down per R6).

**Triage (slang-triager, 11-18 00:25Z — its findings, key receipts Main-verified).**
- REPRODUCED: `-target cpp -fp-mode precise` emits bare `a*b+c`, no pragma/define anywhere;
  `CPPSourceEmitter` has no `emitFrontMatterImpl` override. Downstream contraction verified
  (g++ 12 `-O2 -march=haswell` → `vfmadd132ss`; clang → `llvm.fmuladd`).
- Fix lever: `#pragma STDC FP_CONTRACT OFF` works on clang (file-scope); honored by GCC only
  since 14 (gcc 12 silently ignores — residual gap, doc note); MSVC doesn't contract by default.
- slang-llvm gap confirmed at source/slang-llvm/slang-llvm.cpp:754-760 (only Fast sets
  `opts.FastMath`; Precise never sets `FPContractMode`). gcc downstream already passes
  `-ffp-contract=off` (slang-gcc-compiler-util.cpp:1079).
- Classification: feature-request (bug sub-item: slang-llvm drops Precise) / medium / P2.
  Labels: `reproduced` (Main-verified live 00:29Z), Issue Type=Feature. Not a dup: #14405 is
  CUDA-side human PR, no collision with a cpp fix.
- Solution space: **A+B in one PR** — (A) new `CPPSourceEmitter::emitFrontMatterImpl`
  (mirroring slang-emit-cuda.cpp:401-411) emitting `#pragma STDC FP_CONTRACT OFF` under global
  Precise; (B) slang-llvm Precise branch → `opts.FPContractMode = FPM_Off`. (C) docs-only
  rejected (precedents #11935 SPIR-V, #12801 NVRTC, #13943 Metal all left a trace).
- Scope guards sent to the fixer: non-closing "Part of #14567" PR ref; don't touch CUDA files
  (the #14036 fixer chain owns those); per-value `precise`/E56005 stays out (#13324);
  watch for a reporter self-PR (this reporter wrote #14405 on CUDA).

**Fixer dispatch — judgment call (logged).** The triager read tangent-vector's 11-06 direction on
#14036 ("The recommended approach A seems reasonable to me for the general `-fp-mode precise`
case") as extending to the cpp sibling's global-fp-mode half, and handed to slang-fixer
(session `sess-1794961523276-gy6iw6`, thread `gh-issue-shader-slang/slang-14567`) without a fresh
operator ask. I accepted this on 11-18: the maintainer's wording says "general", the PR ships as a
draft (maintainer review is the gate), and it does not touch the CUDA files under the pending
#14396-vs-#14405 operator decision. If the operator disagrees, stand the fixer down before its
first push. Human-filed issue (not a bot filing), so the filing-policy fixer-start gate for bot-filed
issues does not apply.

**Triage complete 00:25-26Z (triager [Report] msg 12; Main-verified).** Issue 5-bullet posted:
cmt **6965116899** (nv-slang-bot, 00:25:50Z, verified live; only comment). Labels `reproduced` +
Type=Feature set. No collisions with #14396/#14405 (different files).

**11-18 00:42Z: fixer building.** slang-fixer confirmed repro at master (test lane fails as
intended), applied both fixes (pragma + slang-llvm FPM_Off), worktree configure+build started
on `fix/issue-14567` (ETA 20-30 min per its msg 14). Awaiting build verify → draft PR.

**11-18 00:45Z: configure EXIT 1 — submodules uninitialized** (~17 empty, cfg-14567.log;
external/CMakeLists.txt lz4/cmark/vulkan/slang-rhi errors). Fixer stopped per instructions, no
source modified. 00:5xZ: I told it to run `git submodule update --init --recursive` itself
(submodules are public HTTPS, no credential needed; report exact error and stop if egress/auth
fails) and re-run the same lane (my msg 17, in_reply_to its 16).

**11-18 02:48Z: draft PR #14574.** Facts I verified live: OPEN + draft, head `7ae394516`,
`pr: non-breaking`, body = cpp front-matter FP_CONTRACT pragma (gated to
`SourceLanguage::CPP` so CUDA stays byte-stable) + slang-llvm `DefaultFPContractMode = FPM_Off`
for host-callable — note: the triage memo's `FPContractMode` field name was stale for LLVM 21;
the fixer verified `DefaultFPContractMode` against llvmorg-21.1.2; submodule init ran clean
(all public HTTPS) before configure+build went green; "Part of #14567", non-closing. pr-mapping wired → slang-fixer
`sess-1794961523276-gy6iw6` (verified in the table). Fixer reports: suites all green
(new test 4/4; cross-compile/cuda/cpp-compiler/downstream-validation/fp-denormal-mode pass),
CI triggered, explanation comment posted, 3 critique stages approve. [Fix Review Request] with
slang-reviewer; [Fix Report] comes when the verdict lands. Note: submodule init unblocked the
00:45Z configure failure; build then completed (~2 h).

**11-18 04:02Z: [Fix Report] — FIXED, partial by design (Main-verified receipts).** Draft PR
**#14574** now at head `07e612452` (7 commits, +103/−30, 4 files; OPEN+draft, `pr: non-breaking`,
"Part of #14567" non-closing; explanation cmt 6966860726 bot-verified). Design deltas from the
triage memo, both fixer-verified: (1) pragma guard is `#if defined(__clang__)` only — GCC
documents FP_CONTRACT as not implemented in ANY current release (memo's "honored since 14" was
wrong; codex OUTPUT_REVIEW caught it, verified vs GCC 14.2 manual; GCC consumers need
`-ffp-contract=off`, noted in PR); (2) LLVM 21.1.2 field is `DefaultFPContractMode`, memo's
`FPContractMode` stale; slang-llvm change ships with the next slang-llvm module build. Tests
(fixer-reported): repro 4/4, cross-compile 109/109, cpp-compiler 9/9, cuda 149/149,
downstream-validation 9/9, fp-denormal 34/34, build green. Review: APPROVE_WITH_NITS (3
reviewers, 0 bugs), nits applied in 3 follow-ups; codex PLAN/CODE/OUTPUT all approve after two
must-fixes. **Partial scope note: the pragma protects clang-consumed cpp output; GCC remains a
documented `-ffp-contract=off` gap.**
- 04:1xZ: [Fix Report] forwarded to slang-triager (msg 25, thread canonical) for verification →
  [Triage Resolution].
- **State: review-complete, awaiting [Triage Resolution].** Ready-flip on the weekly list; held
  for human review. Watch: reporter albertrodriguezclo may self-PR (their #14405 pattern) — ours
  can be superseded. Fixer plan: /workspace/agent/reports/slang-14567.md (fixer-side).

**11-18 04:05Z: [Triage Resolution] — chain RESTING on maintainer review (our side done).**
Triager independently verified the 7-commit diff + final head state of slang-emit-cpp.cpp and the
test (all acceptance criteria met; commit-6 directive mangling restored in commit 7), re-verified
both of its memo corrections against GCC 14.2 manual / LLVM 21, fixed its own memory + shared
learnings, and PATCHed issue cmt 6965116899 (Main-verified 04:04:54Z: "Fix is in draft PR #14574,
held pending maintainer review", still newest comment). Remaining open scope: per-value `precise` →
#13324; CUDA side → #14396/#14405. Resume triggers: human comment on #14567/#14574, PR CI
webhooks (pr-mapping → fixer gy6iw6), reporter self-PR (ours can be superseded, per #13943/#14405
pattern). Ready-flip → weekly undraft list (not per-PR ask; P2 feature).
