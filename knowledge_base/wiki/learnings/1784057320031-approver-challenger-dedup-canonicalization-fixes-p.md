---
title: "[approver/challenger] dedup/canonicalization fixes: prove the two producers operate on DISJOINT inputs before clearing a 'load content differently' change"
type: learning
topic: review-approval
source: learnings/1784057320031-approver-challenger-dedup-canonicalization-fixes-p.md
---

# [approver/challenger] dedup/canonicalization fixes: prove the two producers operate on DISJOINT inputs before clearing a "load content differently" change

**Symptom:** slang#12034 R3 added a content fallback to ONE of two DebugSource producers: `if (embedContent && content.getLength()==0 && hasFileFoundPath()) loadFile(...)` — so when a resolved SourceFile has empty in-memory content, that producer now disk-loads it. On a PR whose entire purpose is "make two producers emit byte-identical operands so hoistable IR dedup collapses them", any change that makes ONE producer emit different content is a prime candidate to re-introduce the very duplicate the PR removes. The tempting fast-clear ("it only fills in missing content, seems safe") is not enough.

**Root cause / the probe that resolves it:** The question is NOT "is the new content correct?" but "is there any file for which BOTH producers emit a record AND this change makes their content operands differ?" You must identify each producer's INPUT SET and prove disjointness on the triggering condition:
- Producer 1 (per-source-file loop, `slang-lower-to-ir.cpp:15346`) iterates `translationUnit->getSourceFiles()` — the in-build TU sources, which always have in-memory content, and it has NO disk fallback.
- Producer 2 (lazy `getOrEmitDebugSource()`) is where the new fallback lives. The empty-content file that triggers the fallback is a `.slang-module`-deserialized SourceFile brought in via `-r` (through `SerialSourceLocReader::read()` into the SourceManager) — which is NOT in the TU's `getSourceFiles()` list.
- => The file where the fallback fires is emitted by Producer 2 ONLY; Producer 1 never emits a competing record for it → no divergence → no new duplicate. And for the in-build import/#include files (which Producer 1 DOES emit), `getContent()` is non-empty so the new `getLength()==0` guard is false → the fallback doesn't fire → operands unchanged.

**How to catch it:** For a dedup/canonicalization/"make N producers agree" fix, when a later revision changes how ONE producer derives an operand, don't evaluate that operand in isolation. (1) Enumerate every producer of the same structured record. (2) Find each producer's input set (what does its loop/entry iterate?). (3) Prove the changed branch's trigger condition is disjoint across producers, OR that the change is applied symmetrically to all producers. If you can't establish disjointness/symmetry → ABSTAIN (OPEN_GAP), because that's exactly how the original duplicate arises. This is the deeper version of the R2 "hasContent no-op" lesson — R2 cleared the guard as a no-op for the in-build cases, but the SEPARATE-COMPILATION (deserialized, empty-content) case it didn't test was the real trigger. Under-scoping the input set is the miss.

**Fix:** Grep for all callers of the emit primitive (here `emitDebugSource`), read each producer's iteration source, and write the disjointness/symmetry argument explicitly in the investigation before clearing. Corroborate with a targeted regression test result when the change adds one (here a `.slang-module` COMPILE+SIMPLE round-trip; test-slang green confirmed it empirically).

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784057320031-approver-challenger-dedup-canonicalization-fixes-p.md`_
