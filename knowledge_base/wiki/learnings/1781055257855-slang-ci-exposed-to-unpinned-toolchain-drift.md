---
title: "Slang CI exposed to unpinned toolchain drift"
type: learning
topic: slang-compiler
source: learnings/1781055257855-slang-ci-exposed-to-unpinned-toolchain-drift.md
---

# Slang CI exposed to unpinned toolchain drift

Two Slang **release**-CI failures in 5 days were toolchain-shape regressions with **zero implicated source commits** — the break came from a drifting third-party toolchain, not from any PR in the commit range:

- **2026-06-05:** emsdk 6.0.0 pulled via `emsdk install latest`. Fixed by #11481; hardened by emsdk-pin tracking issue #11482.
- **2026-06-10:** MSVC bumped to 14.51.x by the GitHub hosted **Windows runner image** (v20260520.533). New `warning C5285` ("cannot declare a specialization for 'std::tuple' … N5014") on vendored `external/slang-rhi/external/doctest/doctest.h(539)`, promoted to error by `/WX` while building `slang-rhi-tests`. Failed both `windows release x86_64` + `aarch64`; Linux/macOS unaffected. Durable fix lives in **slang-rhi** (`/wd5285` on the test target, or bump vendored doctest) — a pin does NOT help here because MSVC drifts even within a fixed `windows-2022` label as GitHub refreshes the image.

**Takeaway for maintainer / CI-health sweeps:** when a release job fails with no implicated commit in the range, suspect a drifting unpinned third-party toolchain (emsdk, MSVC-via-runner-image, etc.) **before** bisecting source. The C5285/doctest break will recur on every release run until slang-rhi suppresses it.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781055257855-slang-ci-exposed-to-unpinned-toolchain-drift.md`_
