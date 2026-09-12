---
title: "MatrixLayoutMode 'SlangPy Tests' E30015 = post-companion-merge skew (rebase, not a code fix)"
type: learning
topic: slang-compiler
source: learnings/1789151691310-matrixlayoutmode-slangpy-tests-e30015-post-compani.md
---

# MatrixLayoutMode "SlangPy Tests" E30015 = post-companion-merge skew (rebase, not a code fix)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788539622662-eq5rjg
written_at: 2026-09-11T18:34:51.310Z
---

# MatrixLayoutMode "SlangPy Tests" E30015 = post-companion-merge skew (rebase, not a code fix)

When a slang↔slangpy coordinated breaking change lands (here: slang#12986 added the public core-module `enum MatrixLayoutMode` and retyped the matrix layout generic param `int`→`MatrixLayoutMode`; slangpy#1135 adapted `staticarray.slang:10`), the "SlangPy Tests" required check can go red on a cluster of *open slang PRs* with `error[E30015]: undefined identifier 'MatrixLayoutMode'` — and this is NOT a bug on either side.

Key mechanics (verified against ci-slangpy-trigger-test.yml @ slang HEAD):
- The check builds the **PR's own slang commit** (repository_dispatch client-payload `slang_commit_sha`/`slang_ref` = PR head sha) against **slangpy's default branch (main)**.
- So once the slangpy companion (#1135) MERGES TO MAIN, slangpy main starts referencing the new symbol BY NAME. Every slang PR branch still **BEHIND** the breaking commit builds pre-change slang (symbol doesn't exist yet) → **E30015 undefined identifier**.
- This is the OPPOSITE direction from the breaking PR's *documented* error: #12986 documents **E30019** (int→enum type mismatch = NEW slang + OLD slangpy, the pre-companion-merge state that the `SLANGPY_CHERRY_PICK_PR` pin masks). E30015 = OLD slang + NEW slangpy = the *aftermath* once the companion merges. Same skew, opposite direction.

Triage tells: `git grep 'enum X' <breaking-commit>^` empty ⇒ symbol is NEW (added), so "latest slang no longer exposes it" is inverted — latest DOES; the failing builds are on older slang. Check `gh pr view <n> --json mergeStateStatus` = `BEHIND` on every affected PR, and `SLANGPY_CHERRY_PICK_PR` value on master (`""` = clean post-transition; a stale non-empty value would be its own cleanup item).

**Remedy = REBASE/merge master into each affected PR branch** (to pick up the breaking commit). NO slang-core fix, NO slangpy fix, NO tracking issue. `//@hidden:` in `.meta.slang` is docgen-only (MarkupVisibility), not a language access modifier — an unmarked decl in `public module core;` is Public and referenceable by name.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789151691310-matrixlayoutmode-slangpy-tests-e30015-post-compani.md`_
