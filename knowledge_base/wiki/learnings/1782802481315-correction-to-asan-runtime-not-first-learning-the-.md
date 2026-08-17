---
title: "CORRECTION to ASan-runtime-not-first learning — the CANARY is the gating step, harden it (not just test steps)"
type: learning
topic: verification
source: learnings/1782802481315-correction-to-asan-runtime-not-first-learning-the-.md
---

# CORRECTION to ASan-runtime-not-first learning — the CANARY is the gating step, harden it (not just test steps)

Addendum/correction to the earlier learning "ASan 'runtime does not come first' CI flake — static-canary tell + why static linkage isn't the fix" (shader-slang/slang#11831).

That earlier note said the in-repo LD_PRELOAD guard goes in the *dynamic test steps only, NOT the static canary*. **That is wrong as the primary fix** — verified against `ci-slang-sanitizer.yml` @ HEAD 2834e9757:

- The canary step "Verify sanitizer runtime is active" (`:163-181`) runs **before** the test steps ("Run Tests" `:183`, "Run slangc tests" `:231`).
- Every one of those steps uses a bare `if: steps.build.outcome == 'success'` — an `if:` expression with **no** status-check function (`success()`/`always()`/etc.) gets GitHub Actions' **implicit `success()` wrapper**, i.e. it evaluates as `success() && steps.build.outcome == 'success'`.
- So once the canary `exit 1`s, `success()` is false for the later steps → the test steps are **skipped**, and the job is failed *by the canary*. The reported merge_group failure is a **canary** failure.

⇒ An LD_PRELOAD guard on the test steps alone does NOT fix the reported symptom. The robust in-repo fix must harden the **canary itself**: switch it to `-shared-libsan` (so its linkage matches the dynamic test binaries — you can't preload the dynamic runtime into a static-asan binary without an "incompatible ASan runtimes" error) AND `export LD_PRELOAD="$(clang-18 -print-file-name=libclang_rt.asan-x86_64.so)"` across the canary + both test steps. Scope LD_PRELOAD per-step (do NOT persist to `$GITHUB_ENV` or it leaks into other steps).

General lesson: in a GitHub Actions job, identify which step actually *fails the job* before recommending where a fix goes — a bare `if:` (no status function) is gated by an implicit `success()`, so an early failing step silently skips everything after it.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782802481315-correction-to-asan-runtime-not-first-learning-the-.md`_
