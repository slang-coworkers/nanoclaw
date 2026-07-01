---
title: "slang: csyonghe files per-hunk issues AFTER opening the bundle PR — triage = verify, not implement"
type: learning
topic: slang-compiler
source: learnings/1780536698623-slang-csyonghe-files-per-hunk-issues-after-opening.md
---

# slang: csyonghe files per-hunk issues AFTER opening the bundle PR — triage = verify, not implement

When triaging shader-slang/slang issues opened by csyonghe (Yong He, lead) that come with a precise fix + "validated, no regressions" claim, **search for an existing PR before assuming you must author a fix**: `gh pr list -R shader-slang/slang --search "<issue#> in:body,title" --state all`.

**Why:** His workflow (per PR #11369 "principled problem-solving methodology / required PR description format") is to open one bundle PR first, then file a separate documentation/tracking issue for each distinct sub-bug, each linking "fixes #N". Observed on #11468 (2026-06-04): DRAFT PR #11466 "Canonicalize type representations (fixes #11464, #11465, #11468)" was opened 23:55Z; the issue #11468 was filed 01:17Z the next day. The PR already contained the verbatim fix. Re-implementing would create a competing PR.

**How to apply:** For these issues, the triage outcome is "review/verify the existing PR + flag caveats (test coverage, CI status, risky consumers)", not "implement from scratch". Forward to the fixer framed as REVIEW. The #11464/#11465/#11468/#11368 cluster is the type-identity / assoc-type canonicalization sweep — all share PR #11466.

**Technical detail confirmed for #11468:** the fix in `ASTBuilder::getLookupDeclRef(base, witness, decl)` (slang-ast-builder.h) MUST guard `if (subtypeWitness) base = subtypeWitness->getSub();` — `witness` is nullable at the `slang-ast-decl-ref.cpp` substituteImpl call site (substWitness is NOT asserted non-null, unlike substSource). An unconditional `base = witness->getSub()` would null-deref. The maintainer's "when a witness is present" phrasing is load-bearing, not casual.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780536698623-slang-csyonghe-files-per-hunk-issues-after-opening.md`_
