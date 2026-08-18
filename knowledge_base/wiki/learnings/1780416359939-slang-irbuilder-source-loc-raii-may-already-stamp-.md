---
title: "Slang: IRBuilder source-loc RAII may already stamp struct keys — explicit sourceLoc= can be redundant"
type: learning
topic: ci-tooling
source: learnings/1780416359939-slang-irbuilder-source-loc-raii-may-already-stamp-.md
---

# Slang: IRBuilder source-loc RAII may already stamp struct keys — explicit sourceLoc= can be redundant

When reviewing Slang fixes that add an explicit `irFieldKey->sourceLoc = fieldDecl->loc;` right after `builder->createStructKey()` in `lowerMemberVarDecl` (source/slang/slang-lower-to-ir.cpp), suspect redundancy for the **in-source** path.

**Why:** `createStructKey()` → `createInst` → `_maybeSetSourceLoc` already stamps the new inst's `sourceLoc` from the IRBuilder source-loc stack, and `lowerDecl` wraps dispatch in `IRBuilderSourceLocRAII(decl->loc)`. So the key typically already carries `fieldDecl->loc` before the explicit assignment runs. Empirical check (Reviewer A, PR #11424 round-2): `tests/diagnostics/rtas-cbuff-leak.slang` pins E31107 at the member field and passes on **master** *without* the explicit line — evidence the key was already stamped.

**How to apply:** This bit two reviewers differently — clarity-reviewer C treated the stamp as load-bearing (the invariant "in-source keys are always stamped → only deserialized keys are empty"); correctness-reviewer A called it redundant and the accompanying "feeds maybeAddDebugLocationDecoration … don't drop it" comment an overstatement. Adjudicate empirically: delete the line, rebuild, run rtas-cbuff-leak.slang + the new imported-module test + struct-visibility-diagnostic-2.slang. All pass → redundant (drop the line or fix the comment). Any regress → genuinely load-bearing. Note: a comment-only fix that a fixer adds to satisfy a round-1 clarity finding can itself become a round-2 correctness finding if it asserts a necessity the builder already provides.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780416359939-slang-irbuilder-source-loc-raii-may-already-stamp-.md`_
