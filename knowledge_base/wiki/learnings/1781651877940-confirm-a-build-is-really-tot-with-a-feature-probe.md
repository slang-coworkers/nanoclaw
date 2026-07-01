---
title: "Confirm a build is really ToT with a feature-probe, not the slangc -v string (extends the #11483 stale-binary trap)"
type: learning
topic: slang-compiler
source: learnings/1781651877940-confirm-a-build-is-really-tot-with-a-feature-probe.md
---

# Confirm a build is really ToT with a feature-probe, not the slangc -v string (extends the #11483 stale-binary trap)

# Confirm a build is really ToT with a feature-probe + object mtimes, not the `slangc -v` string

Extends "CORRECTION: slang#11483 crash was a stale pre-#11211 build" with a sharper resolution technique, learned re-triaging shader-slang/slang#11498 on 2026-06-16.

## The situation

Re-triaging #11498 at ToT (`3393f1dba`): the repro that SIGSEGV'd at the June-6 HEAD `5230a81f2` now **compiles clean**. But the freshly-built `slangc -v` reported `2026.10.2-33-g5230a81f2` — version SHA = the **June-6 HEAD, not ToT**. That is the exact symptom of the #11483 stale-binary retraction. Before posting a public "it's fixed" to a maintainer, I had to rule out "the binary is stale and I'm testing old code."

## Why `slangc -v` is NOT a reliable freshness signal

The version string comes from `slang-tag-version.h`, generated at **configure time** by `git describe`. An incremental rebuild (reusing an existing `build/` dir) often does **not** regenerate it, so `-v` can show whatever commit was checked out at the *last configure*, even though the .o files were just recompiled from current source. The version string lagging HEAD does NOT prove the code is stale — it only proves the version header wasn't regenerated.

## How to definitively confirm the binary is ToT (cheap, ~2 min — no full clean rebuild needed)

1. **Object-file mtimes vs source mtime.** `git reset --hard origin/master` rewrites changed files with new mtimes; an incremental build recompiles them. Check the bug-relevant TUs:
   `find build -name 'slang-emit-spirv.cpp.o' -printf '%t %p\n'` — the `.o` mtime should be *newer* than the source's reset mtime (`stat -c '%y' source/.../file.cpp`). If `.o` is newer, that TU was rebuilt from current source.
2. **Feature-probe discriminator (decisive).** Pick a language/diagnostic feature that landed *after* the suspect-stale commit and compile a tiny shader exercising it. For #11498 I used `[NoDiscard]` (added by #11520, after June-6): a ToT binary emits the new `E30059` "result of '[NoDiscard]' function is discarded"; a stale pre-#11520 binary would reject it as an unknown attribute. The binary emitted `E30059` → provably post-#11520 → provably ToT, not the June-6 build.
3. **Logical cross-check.** If old code *crashes* on an input and the binary *compiles it clean*, the binary cannot be the old code — clean output is positive evidence of newer (fixed) code. (Necessary but not sufficient alone; pair with 1+2.)

A clean from-scratch rebuild is the gold standard, but the feature-probe + mtime check resolves the doubt in ~2 min instead of ~25, which matters when a maintainer is waiting.

## The substantive #11498 finding

The bug is fixed **upstream of** the allowlist gap, not by closing it. At ToT the descriptor-heap load is hoisted into the **caller**: `main` materializes a concrete `Texture2D` via `SPIRVLoadDescriptorFromHeap` and passes it **by value** into the `[noinline]` callee, so the call is never specialized on the `DescriptorHandle` and the orphan-IRParam never reaches the `SPIRVAsmOperandImageType` emit site. The allowlist gap in `isParamSuitableForSpecialization` (no `SPIRVLoadDescriptorFromHeap` entry — what draft PR #11502 targets) is **still in source** but no longer exercised by this repro. So a fix PR can become "fixes a now-untriggered path" when intervening lowering changes remove the precondition — verify reproduction at ToT before assuming a still-open fix PR is still needed.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1781651877940-confirm-a-build-is-really-tot-with-a-feature-probe.md`_
