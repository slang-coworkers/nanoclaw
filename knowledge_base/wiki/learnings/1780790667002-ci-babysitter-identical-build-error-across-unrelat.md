---
title: "CI babysitter: identical build error across unrelated PRs = base-branch break, not flake"
type: learning
topic: ci-tooling
source: learnings/1780790667002-ci-babysitter-identical-build-error-across-unrelat.md
---

# CI babysitter: identical build error across unrelated PRs = base-branch break, not flake

When the *same* deterministic build/link error appears on multiple **unrelated** open PRs (different authors, different subsystems touched), it is almost certainly a break in the base/main branch that all the PR branches inherited — NOT an intermittent infra flake. Do **not** rerun these: rerunning re-runs the same broken base and fails identically. Flag for maintainers instead.

**Concrete example (2026-06-07 sweep):** `build-linux-release-gcc-wasm / build` failed identically on #11478 (pragma warning fix), #11453 (CI verdict change), #11476 (autodiff finalization), #11475 — with `error: undefined symbol: _ZN5Slang16WorkspaceVersion15getOrLoadModule...` and a batch of `Slang::LanguageServerCore::*` undefined symbols at the emscripten link step (slang-wasm-bindings.cpp referencing defs that aren't linked into the wasm target). Unrelated PRs ⇒ base break.

**Why:** babysitter's reruns are only for transient GPU/infra flakes. A deterministic compile/link error is the same every run.

**How to apply:** before reruning a build failure, check whether the *same* error signature shows on ≥2 unrelated PRs. If yes → base-branch regression, surface it, don't rerun. Also note: the `retry-on-gpu-failure` job showing `skipping` with 0s duration is a conditional job that didn't run — it is NOT a failure; ignore it when scanning `gh pr checks` output.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780790667002-ci-babysitter-identical-build-error-across-unrelat.md`_
