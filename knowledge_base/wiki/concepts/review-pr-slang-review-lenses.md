---
title: "Slang Code-Review Lenses"
type: concept
group: review-process
tags: [pr-review, slang-reviewer, reviewer-a, reviewer-c, false-positives, filecheck, convergence, unreachable-path]
source_count: 6
---

# Slang Code-Review Lenses

Concrete review lenses for the Slang compiler — the reusable "look here" heuristics that surface real bugs (and expose confident false positives) on refactor, null-invariant, and codegen PRs, plus the FileCheck-test nuances that decide whether a regression test actually pins the regression.

## TL;DR
- **Pure-matcher unit tests are not integration coverage.** A unit test proves the extracted helper is correct but says nothing about call-site wiring, ordering, or precedence. For slang-test, a `-dry-run` black-box check (assert the subtest is absent from dry-run stdout) exercises the real scheduling path without running tests.
- **Normalize-before-match blind spot.** When one side of a string comparison is canonicalized (e.g. via `Path::simplify`) and the other is assembled raw, matching silently fails on the platform where normalization isn't a no-op — Windows `kPathDelimiter` is `\`, so a name built with `/` won't match. For any "match a user string against an internal string" feature, check whether one side is normalized and whether the author only tested where normalization is a no-op.
- **When a fix adds a null-possible invariant + safe-access helper, audit ALL structurally-identical sites.** Grep the whole file for `<member>->` and confirm each remaining raw dereference is unreachable under the new condition or asserts/uses the helper. A missed sibling is a latent crash of the exact class just fixed; two reviewers flagging the same untouched site is strong convergence.
- **A reviewer-traced path can be foreclosed upstream by the front-end.** Before adding a regression test for a traced "gap" — and *especially* before treating a 🔴 crash / infinite-recursion / spurious-diagnostic finding as blocking — construct the triggering input and compile it against a built `slangc`. An earlier fatal diagnostic (E30702, E39997, E39999, E41001, E30820) can make the gap unreachable; a confident code trace is not proof the input is reachable, because automated reviewers reason from source and miss earlier rejections.
- **Don't add a recursion/cycle/depth guard for input an earlier fatal diagnostic already rejects** — it is dead code under correct input, which CLAUDE.md forbids (along with changes that have no failing test). Document the termination invariant at the function instead.
- **Trust codex's CONTENT verdict over the PostToolUse hook's stage-verdict parse** when they disagree.
- **FileCheck:** per-entry-point errors → split into separate entry points with per-entry prefixes; module-wide errors → ordered (non-DAG) `CHECK:` lines each pinning a distinct expected/got. Unanchored `CHECK-DAG: <code>` is the anti-pattern (a subset of cases can satisfy all DAG lines, silently missing a regression). A comment containing a literal `CHECK:`/`CHECK-DAG:` token is parsed as a real directive — reword it.

## Reviewer A's Lens: Extracted Matchers and Normalize-Before-Match

Two reviewer lenses that frequently surface on refactor PRs [PR-review lenses: extracted-matcher integration gap + normalize-before-match blind spot](../learnings/1780323605226-pr-review-lenses-extracted-matcher-integration-gap.md):

**Pure-matcher unit tests are not integration coverage.** Unit tests prove the extracted helper is correct but say nothing about the call-site wiring, ordering, or precedence. For slang-test specifically, a `-dry-run` black-box check (asserting the subtest is absent from dry-run stdout) exercises the real scheduling path without running tests.

**Normalize-before-match blind spot.** When CLI entries are canonicalized before storage (e.g. via `Path::simplify`) but the matcher compares by exact string against an assembled display name, the normalization round-trip is a silent gap. On Windows `kPathDelimiter` is `\`; strings assembled with `/` from a source `filePath` can fail to match. Any "match a user-supplied string against an internal string" feature — check whether one side is normalized and the other isn't, and whether the author only tested on the platform where normalization is a no-op.

## Null-Possible Invariant Audits

When a PR establishes a new null-possible invariant for a member (e.g. "`m_param` can be null during result legalization") and adds a safe-access helper, grep the whole file for `<member>->` and confirm each remaining raw dereference is either unreachable under the new condition or asserts/uses the helper. Missing a sibling site reads as either an oversight or a latent crash of the same class as the bug just fixed. Both Reviewer A and C flagging the same untouched sibling site is a strong convergence signal [PR-review heuristic: when a fix adds a null-possible invariant + helper, audit ALL structurally-identical sites](../learnings/1781792411472-pr-review-heuristic-when-a-fix-adds-a-null-possibl.md).

## Reviewer-Traced Unreachable Paths

A code-reading reviewer can trace a plausible bug path that is foreclosed upstream by the front-end. Before adding a regression test for a reviewer-traced "gap," try to construct the triggering input and compile it. If it's rejected upstream (e.g. E30702 for `SV_DepthGreaterEqual` as input), the gap is unreachable — say so with the diagnostic code as evidence, and don't ship a test that can't compile [Depth SV semantics are output-only (E30702) — a reviewer-traced 'inout duplicate' gap can be unreachable](../learnings/1782175276058-depth-sv-semantics-are-output-only-e30702-a-review.md).

This applies with full force to **🔴 crash / infinite-recursion / spurious-diagnostic findings**, which read as blocking. On #11873 (vk::binding on resource-containing struct params), Reviewer A produced a confident 🔴 stack-overflow with a detailed code trace (cited `slang-ir-check-recursion.cpp`, exact line numbers, a sibling-guard comparison) — and it was a false positive because **both of its repros don't compile**. The front-end guards pre-empt the predicate entirely: a value-recursive `struct S { S next; }` entry param hits fatal E39997 "maximum type nesting level exceeded" (bounded at `kMaxTypeNestingDepth = 128`) before `validateEntryPoint` runs; the same struct as a *global* hits E41001 but a global isn't an entry param so the predicate never runs on it (the case A wrongly generalized from); cyclic inheritance hits E39999; interface-before-struct-base hits E30820 (so `findBaseStructType`'s `getFirstOrNull()` is correct by construction). Rule: for any reviewer crash/recursion/spurious-diagnostic claim, **compile the exact repro against a built slangc before treating it as blocking**. Don't pass A's 🔴/high-🟡 through verbatim; add a coordinator verification addendum backed by a compiled repro. (Reviewer C correctly dropped the same termination concern here — its instinct beat A — though C's stated mechanism was imprecise; the real guard is the E39997 depth limit. Reviewer B echoed the PR body: weak signal.) ([Reviewer A (nv-slang-bot) can emit confident false-positive crash bugs whose repros do not compile — always compile the repro](../learnings/1782885111139-reviewer-a-nv-slang-bot-can-emit-confident-false-p.md))

Corollary decision (same #11873 / PR): when a reviewer flags a new recursive walk for "missing a cycle/depth guard that sibling functions carry," do NOT reflexively add the guard — first check whether the divergent input is rejected by an EARLIER fatal front-end diagnostic before your code runs (here E39997/E39999 reject value-recursive/cyclic types before `validateEntryPoint`, so a visited-set would be dead code under correct input). The decision that held (codex + 3-reviewer APPROVE_WITH_NITS): omit the guard and **document the termination invariant at the function** ("descends a finite acyclic structure; cycles rejected earlier by E39997/E39999") — CLAUDE.md forbids guards never hit under correct input and changes with no failing test. Also reinforced: **trust codex's CONTENT verdict over the PostToolUse hook's stage-verdict parse** — the hook parsed the stages as "approve" while codex's content verdict was request-changes for a real, harness-verified item (an unnecessary `non-exhaustive` on a DIAGNOSTIC_TEST, which `slang-test` reports as a failure); a DIAGNOSTIC_TEST should use plain `diag=CHECK` unless you deliberately leave diagnostics unmatched ([Don't add a recursion guard for input an earlier fatal diagnostic already rejects](../learnings/1782886466163-don-t-add-a-recursion-guard-for-input-an-earlier-f.md)).

## FileCheck Test Nuances

Several review-time FileCheck lessons apply across the review pipeline [slang-pr-review: scope a re-run to focused verification when the re-push is test-only](../learnings/1782594329649-slang-pr-review-scope-a-re-run-to-focused-verifica.md):

- For a per-entry-point availability error, split into separate entry points with per-entry filecheck prefixes to isolate each case.
- For a module-wide semantic error, use ordered (non-DAG) `CHECK:` lines, each pinning a distinct `expected/got` pair. Unanchored `CHECK-DAG: <code>` is the anti-pattern: a subset of cases can satisfy all DAG lines, silently missing a regression.
- A comment containing a literal `CHECK:`/`CHECK-DAG:` token is parsed by FileCheck as a real directive — reword such comments.

**Source learnings (6):**

- [PR-review lenses: extracted-matcher integration gap + normalize-before-match blind spot](../learnings/1780323605226-pr-review-lenses-extracted-matcher-integration-gap.md) — unit-testing an extracted matcher isn't integration coverage; check the normalization round-trip on the non-no-op platform.
- [PR-review heuristic: when a fix adds a null-possible invariant, audit ALL structurally-identical sites](../learnings/1781792411472-pr-review-heuristic-when-a-fix-adds-a-null-possibl.md) — grep every raw dereference of the newly-nullable member; two reviewers flagging the same sibling is convergence.
- [Depth SV semantics are output-only (E30702) — a reviewer-traced 'inout duplicate' gap can be unreachable](../learnings/1782175276058-depth-sv-semantics-are-output-only-e30702-a-review.md) — construct and compile the triggering input before shipping a test for a traced gap.
- [Reviewer A can emit confident false-positive crash bugs whose repros don't compile — always compile the repro](../learnings/1782885111139-reviewer-a-nv-slang-bot-can-emit-confident-false-p.md) — a 🔴 crash trace is not proof of reachability; front-end fatals (E39997/E41001/E39999/E30820) can pre-empt the predicate.
- [Don't add a recursion guard for input an earlier fatal diagnostic rejects; trust codex content verdict over hook stage-parse](../learnings/1782886466163-don-t-add-a-recursion-guard-for-input-an-earlier-f.md) — document the termination invariant instead of adding dead-code guards.
- [slang-pr-review: scope a re-run to focused verification when re-push is test-only](../learnings/1782594329649-slang-pr-review-scope-a-re-run-to-focused-verifica.md) — FileCheck: split per-entry-point errors, use ordered CHECK for module-wide, never unanchored CHECK-DAG.
