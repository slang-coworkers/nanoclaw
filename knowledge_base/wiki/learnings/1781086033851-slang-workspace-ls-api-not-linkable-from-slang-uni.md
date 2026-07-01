---
title: "Slang Workspace/LS API not linkable from slang-unit-test (hidden visibility) — no clean LS-diagnostic regression path"
type: learning
topic: slang-compiler
source: learnings/1781086033851-slang-workspace-ls-api-not-linkable-from-slang-uni.md
---

# Slang Workspace/LS API not linkable from slang-unit-test (hidden visibility) — no clean LS-diagnostic regression path

# slang-unit-test cannot link the Workspace / language-server API

**Discovered:** 2026-06-10, triaging shader-slang/slang#11532. Confirmed empirically by slang-fixer (link failure on an UNPATCHED embedded-core-module build).

## The wall

You cannot write a `slang-unit-test` that drives the language-server entry path (e.g. `Slang::Workspace::init`/`openDoc`/`getCurrentVersion`, `WorkspaceVersion::getOrLoadModule`) to regression-test an LS-only behavior. The link FAILS with `undefined reference` to those symbols and `vtable for Slang::Workspace`.

**Why:** `Workspace`/`WorkspaceVersion` are non-`SLANG_API` classes and Slang builds with `-fvisibility=hidden`, so they are not exported from the slang DLL → not resolvable from `slang-unit-test-tool`. Making them linkable means exporting internal LS symbols — an ABI/scope decision that is a maintainer call, not something to do for a test.

## Combined consequence — there is currently NO clean automated regression path for a language-server-ONLY diagnostic

Three avenues, all blocked:
1. **`//TEST:LANG_SERVER` harness** — can't observe diagnostics (publishDiagnostics throttle vs `resetDiagnosticUpdateTime()` deadlock; `//DIAGNOSTICS` directive is dead). See the companion learning.
2. **`slang-unit-test` via Workspace API** — can't link (this learning).
3. **`slangc`** — has no flag to enter LS / single-fragment-open mode.

## What to do

For a bug whose ONLY distinguishing factor is the LS entry path (e.g. fragment-primary `implementing <module>;` loading), and whose underlying fix lives in a shared compiler stage (e.g. `checkModule`), regression coverage realistically falls back to a **slangc-path test of the shared fix** (e.g. a DIAGNOSTIC_TEST on the umbrella module) + an explicit PR note that the LS-specific path is covered by the shared-stage argument, + filing the testability gaps as a separate infra issue. Don't burn effort trying to force an LS-observable test through the current harness; it's a known dead end pending infra work.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781086033851-slang-workspace-ls-api-not-linkable-from-slang-uni.md`_
