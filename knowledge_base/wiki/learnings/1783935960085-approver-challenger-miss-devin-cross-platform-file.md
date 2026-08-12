---
title: "[approver/challenger-miss] Devin cross-platform filename bugs on tutorial run-scripts are often false positives — verify the tool's actual naming convention in source"
type: learning
topic: review-approval
source: learnings/1783935960085-approver-challenger-miss-devin-cross-platform-file.md
---

# [approver/challenger-miss] Devin cross-platform filename bugs on tutorial run-scripts are often false positives — verify the tool's actual naming convention in source

**Symptom:** On PR shader-slang/slang#11977 (docs tutorial), Devin (Reviewer B) raised a 🔴 "Bug": `run-tutorial.ps1:129` "passes the wrong manifest file path on Windows, breaking report-generation." A red bug forces BLOCK, so it had to be adjudicated before any WOULD_APPROVE/ABSTAIN could stand. The primary production review (github-actions[bot]) had flagged NO such bug.

**Root cause of the false positive:** The script passes `--manifest "$kernel.coverage-manifest.json"` where `$kernel` = `hello-coverage-kernel.dll` on Windows / `.so` elsewhere. Devin pattern-matched "`.dll` in a manifest filename looks wrong" without checking how slangc actually names the sidecar. slangc names it by **literal string concatenation** of the `-o` output path + `.coverage-manifest.json` (`source/slang/slang-end-to-end-request.cpp:529`; `_getEntryPointPath` returns the `-o` value verbatim at `:397-399`) — no extension stripping. So `-o hello-coverage-kernel.dll` → `hello-coverage-kernel.dll.coverage-manifest.json`, exactly what ps1:129 passes. The `.ps1` is symmetric with the PR-verified `run-tutorial.sh:81`.

**How to catch it:** When a secondary reviewer (esp. Devin) flags a filename/path "bug" in a cross-platform script — Windows `.dll` vs POSIX `.so`, path separators, extension handling — do NOT take it as a 🔴 on face. Find where the *tool* constructs that filename in source and confirm the convention (concatenation vs strip-and-replace vs source-derived). If the script mirrors a sibling script that the PR states was actually executed, that's strong corroboration the path is right. A red bug that only ONE reviewer raises, and that the head-matched primary review missed, deserves source-level verification before it drives BLOCK.

**Fix / rule:** Verified-false Devin filename bugs must be cleared with a file:line citation of the tool's naming code, not dismissed by intuition. Here: ps1:129 CORRECT → no BLOCK; decision rested on a separate, real doc-accuracy gap instead. codex independently concurred with the false-positive verdict. Relates to [[approver-infra-abstain-harvest-exit-timing-race]] (same PR, primary-signal recovery).

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1783935960085-approver-challenger-miss-devin-cross-platform-file.md`_
