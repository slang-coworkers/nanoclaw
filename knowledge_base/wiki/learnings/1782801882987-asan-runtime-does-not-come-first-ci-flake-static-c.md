---
title: "ASan 'runtime does not come first' CI flake — static-canary tell + why static linkage isn't the fix"
type: learning
topic: ci-tooling
source: learnings/1782801882987-asan-runtime-does-not-come-first-ci-flake-static-c.md
---

# ASan "runtime does not come first" CI flake — static-canary tell + why static linkage isn't the fix

> **⚠️ SUPERSEDED 2026-07-13 by [[1782802481315-correction-to-asan-runtime-not-first-learning-the-]]** — that note corrects this one: the LD_PRELOAD guard belongs in the static canary too (it IS the gating step), not only the dynamic test steps. Follow the newer note.

# ASan "runtime does not come first" CI flake — static-canary tell + why static linkage isn't the fix

Triaging shader-slang/slang#11831 (intermittent `sanitizer-linux-clang-x86_64` failure: "ASan runtime does not come first in initial library list", GCP linux-build pool).

**Diagnostic tell for env-vs-code:** Slang's sanitizer test binaries are *dynamic*-asan (`-shared-libsan`, `cmake/CompilerFlags.cmake:253-259`), but the canary step (`ci-slang-sanitizer.yml:163-181`, the `clang-18 -fsanitize=address ... -o /tmp/asan-canary` at ~:173) is built *static*-asan (no `-shared-libsan`). If even the **static-asan** canary hits the "does not come first" abort, the root cause is almost certainly a global `/etc/ld.so.preload` (or env `LD_PRELOAD`) on the runner VM — only a *preloaded* library can come ahead of a statically-linked-asan main executable in the initial library list. So that asymmetry is a clean discriminator: static canary also aborting ⇒ environment/VM injection, not a Slang code/workflow defect.

**Why fix-direction "static ASan linkage" is wrong here:** `CompilerFlags.cmake:254-256` documents that clang's default *static* asan runtime is incompatible with `-Wl,--no-undefined`, which is exactly why `-shared-libsan` (dynamic) was chosen. Flipping to static resurfaces that link incompatibility AND (per the static-canary evidence above) likely won't even immunize against an `ld.so.preload` injection. So that direction risks breaking the build without fixing the flake.

**Right fixes:** (root cause) strip the stray preload from the GCP pool-VM image — pure infra/ops; (belt-and-suspenders, in-repo) `export LD_PRELOAD="$(clang-18 -print-file-name=libclang_rt.asan-x86_64.so)"` in the *dynamic* test steps only — NOT the static canary (preloading dynamic alongside static asan errors with "incompatible ASan runtimes").

**Bot-scope note:** both good fixes are off the bot's push surface (infra ops; or `.github/workflows/*.yml` which the bot can't push). The only bot-pushable file (CompilerFlags.cmake) is the approach to avoid → not bot-completable as a code PR; play is diff-as-comment + infra handoff.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782801882987-asan-runtime-does-not-come-first-ci-flake-static-c.md`_
