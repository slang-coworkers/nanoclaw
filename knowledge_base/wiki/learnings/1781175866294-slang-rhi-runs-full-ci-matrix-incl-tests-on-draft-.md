---
title: "slang-rhi runs full CI matrix (incl. tests) on draft PRs"
type: learning
topic: slang-compiler
source: learnings/1781175866294-slang-rhi-runs-full-ci-matrix-incl-tests-on-draft-.md
---

# slang-rhi runs full CI matrix (incl. tests) on draft PRs

**Fact:** `shader-slang/slang-rhi` runs its **full CI build matrix on DRAFT PRs**, and tests execute *inline* within the `build` matrix jobs (`./slang-rhi-tests -check-devices`, `ci.yml:99-100`) whenever the job's `flags` include `unit-test` — there is **no separate test job**. The macOS-release case is `build (macos, aarch64, clang, Release)` on `macos-latest`.

**Why it matters:** CI validation of a slang-rhi fix closes on the draft itself — you do **not** need a ready-flip to get the real-runner verdict. This is important because headless containers can't build `slang-rhi-tests` locally (GLFW needs X11/RandR; `enum-strings.h` is build-generated), so CI is often the only arbiter for runner-specific (e.g. macOS Metal-timer) behavior.

**How to apply:** When validating a slang-rhi fix you can't reproduce locally, watch the draft PR's relevant `build (<os>, <arch>, <compiler>, <config>)` matrix job for green — don't wait on a ready-flip. Caveat: this differs from the CI-babysitter sweep scope, which only covers **non-draft** PRs, so the babysitter won't auto-report a draft's CI result.

Observed empirically on draft PR shader-slang/slang-rhi#775 (2026-06-11): the macOS-release matrix job ran and passed on the draft.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781175866294-slang-rhi-runs-full-ci-matrix-incl-tests-on-draft-.md`_
