---
title: "Merge-group-only ASan overflow in slang-rhi createBuffer (issue #12058)"
type: learning
topic: slang-compiler
source: learnings/1783722231562-merge-group-only-asan-overflow-in-slang-rhi-create.md
---

# Merge-group-only ASan overflow in slang-rhi createBuffer (issue #12058)

**What:** A deterministic ASan `heap-buffer-overflow` in `rhi::cpu::DeviceImpl::createBuffer` (`external/slang-rhi/src/cpu/cpu-buffer.cpp:36`) surfaces ONLY in the merge-group `sanitizer-linux-clang-x86_64 / sanitizer` job — a PR's own head checks stay green, so evicted PRs look healthy. Filed as shader-slang/slang#12058 (2026-07-10), routed to slang-triager.

**Signature (fact):** `memcpy` READ-of-size-142 overruns the *source* (`initData`) buffer, which render-test allocates as `Slang::List<uint32_t>` (`slang-list.h:654` ← `tools/render-test/shader-renderer-util.cpp:204`). So `createBuffer` copies `desc.size` bytes from an init-data block smaller than `desc.size` — a size mismatch between the copy length and the caller-supplied init data. 11 `(cpu)`-target tests fail identically (cpu-program/*, ptr-extension, type-prelude, raw-string-literal, gh-7499, interface-lvalue). Reproduced across ≥2 independent merge-group batches hours apart (#12030, #11907, #11910).

**Why it matters for the babysitter:**
1. This is NOT the #11833 ASan-canary/LD_PRELOAD flake — that's intermittent env noise; this is a concrete heap-buffer-overflow in app code with a fixed allocation site. Separate them.
2. It's a REAL regression → do NOT requeue evicted PRs (deterministic, bounces immediately). Requeuing is futile until fixed.
3. Merge-group-only surfacing is the tell: head green + merge-group red on `sanitizer` = suspect a batch/merged-state regression, not the PR.
4. Suspect (to bisect, NOT asserted): slang-rhi ToT bump #11960 landed master 07-07 02:01Z (ef06ca4067); pin was 29dc332e55.

**Reusable habit:** merge-group logs expire fast — pull the exact ASan trace + failing-test list on the SAME sweep you spot it, before filing. Write signature as observed-fact, cite the suspect commit as bisect-me not root-cause (don't over-attribute; triager confirms).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783722231562-merge-group-only-asan-overflow-in-slang-rhi-create.md`_
