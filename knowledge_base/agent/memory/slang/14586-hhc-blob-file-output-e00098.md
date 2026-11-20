---
type: chain
title: slang#14586 — via-LLVM host-host-callable file output fails with E00098 "cannot access as a blob"
description: BOT-filed 11-18 09:2xZ by slang-triager (split out of #14582 per triage ruling; verifier-valid repro in body). FILED-ONLY, deliberately sequenced behind PR #14581's merge — no dispatch on its issue_opened.
tags: [cpu, llvm, host-host-callable, blob, e00098, bot-filed, terminal-our-side, echo-hazard]
---

# slang#14586 — HHC `-o` file output: E00098 "cannot access as a blob"

**Issue.** https://github.com/shader-slang/slang/issues/14586 — bot-filed (nv-slang-bot) by the
slang-triager on 2026-11-18 (~09:20Z) as the split-out of [#14582](14582-cpu-llvm-hoc-hhc-verifier-callsites.md):
on `-target host-host-callable -emit-cpu-via-llvm`, JIT succeeds but any `-o` file output fails with
`error[E00098]: cannot access as a blob`, exit 255 — even for verifier-valid modules with no compute
kernel (`export int foo(int x) { return x + 1; }`). Reproduced on master `2026.13.1-50-g3649fb982`.
Root-cause area (triage hypothesis): `HostHostCallable` arm of `emitLLVMForEntryPoints`
(`source/slang/slang-emit.cpp`) yields a JIT library artifact that exposes no blob representation, so
the write path dies with generic E00098 instead of writing bytes or diagnosing. Labeled `reproduced`.

**Folded scope (per the body):** first-ever compute-kernel test coverage for `host-object-code` and
`host-host-callable` (`tests/llvm/` covers `llvm-host-ir` only) rides with this fix chain.

**Disposition (11-18 09:2xZ).**
- Its `issue_opened` is a **self-echo of our own Terminal filing** — body carries full verification
  (repro, master sha, root-cause hypothesis, sequencing). **No triage dispatch** (#14542/#14546
  pattern). Session check 09:22Z: no triager/fixer session on the canonical thread
  `gh-issue-shader-slang/slang-14586`; the only session is Main-side (the webhook handling itself).
- **FILED-ONLY.** Fix work is deliberately sequenced behind **PR #14581's merge** (per the body):
  #14581 rewrites the CPU entry-point surface; racing it would duplicate work (the #14582 chain
  already learned this). Once #14581 lands, a small chain closes this: blob failure fix/diagnostic
  + two-target compute-kernel test coverage.
- Fixer start (now or after #14581) gates on the **operator** (filing policy — new fixer chains are
  reported, not auto-started).

**Scope expansion (albertrodriguezclo, cmt 6986817726, 11-18 ~10:1xZ).** The same E00098 hits
**plain `-target host-callable`** (no `-emit-cpu-via-llvm`) whenever slang-llvm is available —
any input, any `-o` extension; without `-o` it silently succeeds (writes nothing). Old bug:
reproduced on 2025.10.1, 2026.19 release and master. His root cause: `getDownstreamCompilerForTransition`
prefers LLVM → `LLVMBuilder::generateJITLibrary` artifact's only representation is an in-process
`ISlangSharedLibrary` (ORC LLJIT), no file/blob behind it; `EndToCompileRequest::_writeArtifact` →
`writeToFile` → `_requireBlob` fails with generic E00098, while the stdout path
(`writeArtifactToStandardOutput`) early-returns for `ArtifactKind::HostCallable` — the file path
lacks the equivalent check. Proposed fix: fire a specific diagnostic (his example E00136) when
`HostCallable` + `loadBlob` fails, naming `-target shader-sharedlib`/`-target sharedlib` as the
file-writing alternatives; only fires when no blob exists, so a C++-compiler-backed host-callable
artifact (no slang-llvm) still writes as before. Test: `tests/diagnostics/host-callable-output-file.slang`
(host-callable + host-host-callable via-LLVM, E00136 reported / E00098 not / non-zero exit).
**He has the fix + test locally and offered to open the PR once #14581 is in; happy to leave it to
us otherwise.** Disposition: invited his PR (human PR beats a bot chain); bot fixer chain stays down
while his offer is live — operator call only if he declines.

**Triager receipts (handled 11-18 17:55Z, Main-verified live).** Both his code claims verified against
master by the triager: (1) `writeArtifactToStandardOutput` early-returns for
`isDerivedFrom(kind, ArtifactKind::HostCallable)` — `source/slang/slang-end-to-end-request.cpp:391-399`;
(2) file path `_writeArtifact` → `ArtifactOutputUtil::writeToFile` → `_requireBlob` diagnoses generic
E00098 with no HostCallable check — `source/slang/slang-artifact-output-util.cpp:151-163` (call at
:245-264, from slang-end-to-end-request.cpp:484-488). Bot reply posted (fresh comment, last commenter
was the human): https://github.com/shader-slang/slang/issues/14586#issuecomment-6986932346 — ack +
PR invitation (diagnostic ID/wording settled in review). Issue body carries one "Scope update
(2026-11-18)" section (verified live). No label changes. **Chain now parked: next event = PR #14581
merge, then his PR (review as normal) or — only if he declines — an operator-gated bot fixer chain.**

**Guardrails.**
- Do not re-dispatch #14586's webhooks; if a human comments on it, that is a live inbound for this
  record's owner (Main) to evaluate.
- Background family: [#14569](14569-cpu-llvm-sb-atomic-e41403.md) → #14578/#14579 (PR #14581) →
  #14582 → this split. #5284 (closed 2024) shows the same generic E00098 in another subsystem.
