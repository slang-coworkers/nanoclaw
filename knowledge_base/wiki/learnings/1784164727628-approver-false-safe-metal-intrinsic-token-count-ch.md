---
title: "[approver/false-safe] Metal intrinsic token-count change breaks untouched Metal COUNT tests; ci_green clause is blind to check-runs"
type: learning
topic: slang-compiler
source: learnings/1784164727628-approver-false-safe-metal-intrinsic-token-count-ch.md
---

# [approver/false-safe] Metal intrinsic token-count change breaks untouched Metal COUNT tests; ci_green clause is blind to check-runs

**PR:** shader-slang/slang #12130 @ a891de261b27 (bot fixer PR for #12046, Devin-only tier). Decision: BLOCK (RED_BUG). Would have been WOULD_APPROVE (a false-safe) if I had trusted Devin (0 bugs) + the human APPROVE without checking CI check-runs myself.

**Symptom.** A PR whose compiler changes are each individually correct still turns CI red because it changed the *number of tokens* a Metal intrinsic emits, and pre-existing UNTOUCHED filecheck tests assert the old token count. Here F3 simplified the Metal `fmod` intrinsic from a two-`fmod(`-token sign-correcting ternary `(($0<0.0)?-fmod(-$0,abs($1)):fmod($0,abs($1)))` to a single `__intrinsic_asm "fmod"`. The untouched tests `tests/metal/math-vector.slang:189` and `tests/metal/math-scalar.slang:181-182` assert `// METAL-COUNT-2: fmod(` / `// METALLIB-COUNT-2: fmod.f32` — counts calibrated to the old ternary's two tokens. Post-change there is one token per call → `expected string not found (2 out of 2)` → deterministic failure on all three `test-slang` jobs (linux-debug/-release aarch64, macos-release). The PR updated the F1/F2 tests it *authored* but missed the pre-existing Metal fmod tests the F3 change invalidates.

**Root cause (why the approver almost missed it).** Two blind spots stacked:
1. Devin (the sole review-bot signal on bot fixer PRs) does NOT build or run the test suite — it reported 0 bugs. This is the #12122 false-safe class.
2. The `ci_green_on_sha` clause reads GitHub's *combined-status* API (`repos/{repo}/commits/{sha}/status`), which returns `state=success` here because it only sees legacy commit statuses (`license/cla`, `SlangPy Tests`). The failing `test-slang` jobs are GitHub **check-runs**, invisible to the combined-status API. And policy `require_ci_green=false` makes the clause pass trivially anyway. So Step 1 was clean; only the Step-3 challenger caught the red CI.
Also: the human APPROVE landed at 00:40:18Z, ~8 min BEFORE the test-slang jobs finished (~00:48-00:50Z) — approval on incomplete CI is not evidence of green CI.

**How to catch it.** In the challenger, for ANY PR that changes an emitter or an intrinsic's `__intrinsic_asm`/`spirv_asm` body: (a) always fetch CI via `gh pr checks` or the check-runs API (`repos/{repo}/commits/{sha}/check-runs`), NEVER rely on the combined-status API — it is blind to check-runs, and `require_ci_green=false` means the clause won't gate it either; (b) grep the tree for pre-existing filecheck tests over the *same intrinsic on other targets* (`grep -rn "COUNT-.*<intrinsic>(" tests/`), because a token-count or opcode change silently invalidates untouched `COUNT-N` / `-NOT` / `-SAME` expectations the author didn't think to update. A change that alters emitted-token multiplicity is the specific trigger.

**Fix.** BLOCK, reason_code `RED_BUG:test-slang-metal-fmod-count`. A PR-caused, deterministic, cross-runner `test-slang` failure at the pinned head is a verified RED_BUG → BLOCK, even when the fix is merely "update the stale CHECK lines" and the compiler code is correct. It is NOT ABSTAIN_POLICY(OPEN_GAP): an OPEN_GAP is an unproven/uncertain risk; here the failure is concrete, reproduced, and author-owned. Precedent: #12122, #12106-R1, #12125-R1 all recorded PR-caused CI regressions as BLOCK. Related: [[pr-12122-decided]].

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784164727628-approver-false-safe-metal-intrinsic-token-count-ch.md`_
