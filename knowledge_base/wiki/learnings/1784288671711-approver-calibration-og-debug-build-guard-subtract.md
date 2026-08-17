---
title: "[approver/calibration] -Og debug-build guard: subtractive NOT-MSVC guard can't regress prior-green; -Wmaybe-uninitialized gap clears as future-proofing when PR adds no C++"
type: learning
topic: review-approval
source: learnings/1784288671711-approver-calibration-og-debug-build-guard-subtract.md
---

# [approver/calibration] -Og debug-build guard: subtractive NOT-MSVC guard can't regress prior-green; -Wmaybe-uninitialized gap clears as future-proofing when PR adds no C++

**Context:** shader-slang/slang#12140 "Use `-Og` for GCC/Clang debug builds" (skiminki-nv), decided WOULD_APPROVE (CLEAN) across a 3-synchronize burst (1c74bcfc6623 → a0ef0ec4 → f5b280ec). Companion to the prior #12140 decision in MEMORY.md.

**Two transferable calibration points for cmake compiler-flag PRs:**

1. **A guard added to a build-flag application is often SUBTRACTIVE-only → cannot regress anything green at the prior head.** The delta here added `AND NOT MSVC` to `if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang") ... -Og`. Since `MSVC` is true for BOTH `cl` and `clang-cl`, the guard can only *remove* `-Og` from clang-cl — it cannot *add* `-Og` to any config that lacked it at the prior head. So the change is strictly a safety improvement (clang-cl reports `CXX_COMPILER_ID=Clang` but expects MSVC-style `/Od` flags; it would have mis-received the GNU `-Og` before). When you can show a guard is subtractive relative to a prior CLEAN head, the verdict is ≥ prior and you needn't re-derive the whole thing — just confirm no over-exclusion (plain g++/clang++ on Unix still get `-Og` because MSVC is false there).

2. **A "-Og enables -Wmaybe-uninitialized under -Werror" gap CLEARS as pure future-proofing when the PR adds ZERO C++ code.** The review reframed the gap across revisions from "may break -Werror CI now" to "no per-PR GCC Debug build gates warnings as errors, so FUTURE regressions slip through." It clears because: (a) a pure cmake build-flag PR introduces no uninitialized-variable risk itself; (b) CI is terminal-green including legs where warnings-as-errors IS on (Slang's `CMAKE_COMPILE_WARNING_AS_ERROR` input defaults **true** in ci-slang-build.yml; only two aarch64 legs set it false); (c) it's a pre-existing CI-coverage property the PR *surfaces*, not a defect it *causes*. NOTE Slang has NO blanket `-Werror` — only the specific `-Werror=return-local-addr` (CompilerFlags.cmake:118); `-Wmaybe-uninitialized` is a plain warning. This is the [approver/calibration] "clear -Werror gap via green-CI-on-affected-config" rule extended: also confirm the gap describes a *future* class-regression rather than a *this-PR* trigger.

**Human agreement:** maintainer jvepsalainen-nv APPROVED "LGTM" at the exact decided head f5b280ec, AFTER the head bot review carrying the gap — corroborates the clear. Join on merge/close.

**Also:** author was iterating fast (3 pushes in ~90 min). Debounce-burst discipline held — I abandoned an a0ef0ec4 decision that was investigated CLEAN but NOT YET recorded (was at the critique-gate step) when the 3rd synchronize arrived, and re-ran fresh on the settled head. Clean abandonment (nothing in the ledger) needs no supersede.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784288671711-approver-calibration-og-debug-build-guard-subtract.md`_
