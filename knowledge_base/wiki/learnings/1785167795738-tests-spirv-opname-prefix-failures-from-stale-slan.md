---
title: "tests/spirv OpName-prefix failures from stale slangc = core-module embedding, not a regression (verify binary provenance first)"
type: learning
topic: slang-compiler
source: learnings/1785167795738-tests-spirv-opname-prefix-failures-from-stale-slan.md
---

# tests/spirv OpName-prefix failures from stale slangc = core-module embedding, not a regression (verify binary provenance first)

**Symptom:** A `tests/spirv/*.slang` test that checks an emitted `OpName` string fails deterministically with the OLD spelling (e.g. `OpName %dotResult "dotResult"` when the test expects `__dotResult`). Looks like a real regression because it's a fixed expected-string mismatch, not a timing/flake.

**Root cause (real case, 2026-07-27):** `internal-spirv-asm-opname-prefix.slang` failed this way. It was NOT a master regression — the on-disk prebuilt `slangc` was STALE. The `__`-prefix fix (#12108 / PR #12190, commit 72985f871, landed 07-24 04:31Z) renamed internal spirv_asm registers in `source/slang/hlsl.meta.slang` (`%dotResult`→`%__dotResult`) AND added the test. The prebuilt binary was built at an older commit (build tag showed `g3649fb982`, mtime 07-23) that predated the fix.

**Why the binary alone determines the result:** the core module (`hlsl.meta.slang`, `core.meta.slang`, …) is **embedded into slang-bootstrap/slangc at compile time**. A binary built before a meta.slang change still emits the OLD content regardless of the corrected source/test on disk. So any test whose expectation depends on core-module content will "fail" against a stale binary.

**How to triage this fast (read-only, no full rebuild needed to DISMISS):**
1. `grep <expected-string> source/slang/*.meta.slang` — is the CURRENT source correct at HEAD? (If yes, the source isn't the problem.)
2. `build/Debug/bin/slangc -v` → note the `g<sha>` build tag; `ls -la build/Debug/bin/slangc` for mtime.
3. `git log --oneline -- tests/<the-test>` → find the commit that added the test/fix.
4. `git merge-base --is-ancestor <fix-commit> <binary-build-sha>` → if NO, the binary predates the fix ⇒ stale-binary artifact, DISMISS.
5. Empirical clincher: run the shader through the stale binary and see the old name; then rebuild (see below) and see it pass.

**Gold-standard confirm (rebuild):** per CLAUDE.md stale-bootstrap guidance, `cmake -E touch source/slang/hlsl.meta.slang` → `cmake --build --preset debug --target generate_core_module_headers` → build `slangc`/`slang-test`. Skipping the touch+regen can leave the bootstrap embedding the OLD source silently.

**Gotcha for running spirv-asm tests manually:** `-target spirv-asm` needs the `slang-glslang` downstream (spirv-dis) — set `LD_LIBRARY_PATH` to the built lib dir (e.g. `build/Debug/lib` or `build/slang-*/lib`) and use `-O0` to skip the spirv-opt downstream, or you'll get `E00100 failed to load downstream compiler 'spirv-opt'/'spirv-dis'` noise unrelated to the actual test.

**Lesson:** before treating a deterministic `tests/spirv` OpName/string mismatch as a regression, VERIFY BINARY PROVENANCE (build tag vs the fix commit). Intermittent-red master CI + a stale local binary is a common false-alarm combo.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785167795738-tests-spirv-opname-prefix-failures-from-stale-slan.md`_
