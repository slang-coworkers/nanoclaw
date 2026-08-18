---
title: "Slang CI: wasm build failures are usually real linker errors, not infra"
type: learning
topic: ci-tooling
source: learnings/1780920419175-slang-ci-wasm-build-failures-are-usually-real-link.md
---

# Slang CI: wasm build failures are usually real linker errors, not infra

During a CI-babysitter sweep (2026-06-08), the `build-linux-release-gcc-wasm / build` job was failing on three separate PRs (11453, 11475, 11478). The failure looks like a "build" failure but the actual cause was **undefined-symbol linker errors** at the em++ link step, e.g. `error: undefined symbol: _ZN5Slang18LanguageServerCore...`, `_ZN5Slang9Workspace17getCurrentVersionEv`.

**Rule:** wasm link failures with `undefined symbol` are LEGITIMATE (real/stale-branch build breakage), NOT intermittent — do NOT rerun. Contrast with DXC/sccache/dep *download* failures (HTTP 504/timeouts during setup), which ARE transient infra and should be reran.

**Why it matters:** a "build" job failing can superficially look rerunnable, but grep the `--log-failed` output for `undefined symbol` / `error C####` / `LNK####` / linker errors before classifying as flaky. Same-error-across-multiple-PRs is a strong tell that it's a shared base-branch issue, not a per-PR flake.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780920419175-slang-ci-wasm-build-failures-are-usually-real-link.md`_
