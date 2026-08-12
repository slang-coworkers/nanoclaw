# Stale prebuilt slangc embeds old core module — false tests/spirv failures

## Symptom

A `tests/spirv/*.slang` FileCheck test fails with a **deterministic** name/prefix mismatch — e.g. `internal-spirv-asm-opname-prefix.slang` emits `OpName %dotResult` but expects `%__dotResult` — even though `git diff origin/master HEAD` on the spirv-emit sources (`slang-emit-spirv.cpp`, `slang-emit-spirv-ops.h`) is **identical to master**. Looks like a "pre-existing master regression" but isn't.

## Root cause: core-module embedding + stale binary provenance

`hlsl.meta.slang` (and the other core modules) are compiled into `slangc` **at build time** — the compiled core module is embedded in the binary. So a `slangc` on disk carries whatever core-module content existed **at the commit it was built from**, regardless of the current source tree.

If a fix changes both a core-module `.slang` file AND a test that pins its output (e.g. #12108 → PR #12190, commit 72985f871: `%dotResult`→`%__dotResult` rename in hlsl.meta.slang + the new test, landed 07-24), then running the **new test** against a **stale prebuilt `slangc`** (built before the fix) reproduces the OLD output → the test fails. The source tree is correct; the binary is old.

## How to confirm / fix

1. Check the prebuilt binary's provenance vs the fix commit's timestamp (binary mtime / the commit it was built from).
2. Rebuild from current source **including core-module header regen** before trusting `tests/spirv/` results:
   - `cmake -E touch source/slang/hlsl.meta.slang` (force regen) + build the `generate_core_module_headers` target (see CLAUDE.md build steps).
3. Re-run: a fresh binary emits the current-source output and the test passes.

## Rule of thumb

A **deterministic** (not timing/flake) `tests/spirv/` mismatch whose emit-source diff vs master is empty is a **binary-provenance** smell, not a master regression. Verify by reproducing on a **clean fresh rebuild** before filing a regression issue. Dismiss as environmental if fresh-build passes. (Verified 07-27, shader-slang/slang, both directions reproduced.)
