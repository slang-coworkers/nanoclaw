---
title: "Approver challenger technique: reachability, revision diffing, and severity discipline"
type: concept
group: misc
tags: [slang-pr-approver, challenger, reachability, revision-diff, rebase, release-assert, downcast, positive-control, docs-review]
source_count: 8
---

## TL;DR

Where the calibration atoms record *whether* a decision matched the human, these
record *how* the challenger should reason so the decision is right in the first
place. The unifying theme: **trace the mechanism to the site that actually
crashes/matters, at the exact SHA, before assigning severity** — never inherit a
review's 🔴 or credit a revision with a fix on surface appearance.

Load-bearing rules:

- **Prove the consumer is REACHED before a BLOCK.** A "producer makes V null;
  consumer raw-derefs V → crash" finding is only a BLOCK if the consumer is proven
  reached on the target; a lowering pass that strips/rewrites the type first makes
  it at most ABSTAIN. Trace the data type through to the assert site, not just the
  source decl.
- **A debug-only `SLANG_ASSERT` guarding an unchecked downcast is a real release-UB
  gap, not a nit** — `SLANG_ASSERT`→`SLANG_ASSUME`→`[[assume]]` in release *tells*
  the optimizer the condition holds instead of checking it, and `DeclRef::as<U>()`
  re-wraps with no dynamic check. Ask: is the invariant PROVEN, and does the
  early-out cover EVERY violating branch?
- **A comment-only revision resolves a clarity gap, never a correctness gap.** Diff
  the incremental patch (`gh api compare/<prev>...<new>`) before crediting a
  synchronize with a fix; a freshly-green primary + a maintainer LGTM do not imply
  the flagged logic changed.
- **A synchronize with a moved `diff_hash` can be a pure rebase.** The authoritative
  artifact is `gh pr diff` (base...head) content, not `diff_hash` (includes `@@`
  offsets + blob-ids) or `compare/old...new` (includes intervening master).
- **Re-verify a carried gap's full mechanism at each new head after a rebase** — a
  rebase invalidates line numbers and can silently open or close the gap; "the two
  cited lines read byte-identical" is not "the gap still holds."
- **A documented `SLANG_RELEASE_ASSERT` on an unproven-reachable path is a
  hardening improvement, not a new 🔴.** Never BLOCK on an unproven crash;
  investigation can only add caution.
- **A primary "0 bugs" does not override persistent, independent secondary
  correctness flags on the PR's core purpose** — two tools converging on one
  unrefuted mechanism is real doubt ⇒ ABSTAIN, not round-up.
- **Docs PRs need an editorial-appropriateness pass beyond fact-checking** — a
  factually-correct document can still be the wrong document.

## Reachability and downcast severity

The reachability discipline appears twice with concrete traces. On the safe side, a
bot-authored type-legalization crash-fix (#12719) was approvable because the new
path is exercised by a genuine positive-control test on a GPU-free target
(crash→compiles), the new helper only *narrows* an existing shortcut, and the
newly-handled switch case faithfully mirrors an established twin — none add a guard
masking malformed IR
[bot type-legalization crash-fix safe shape](../learnings/1788257588030-approver-confirmed-safe-bot-authored-type-legaliza.md).
On the gap side, when a fix guards a downcast with a *debug-only* assert
(`SLANG_ASSERT(x.is<T>())` before `x.as<T>()`), that is release-UB because the
assert compiles to `[[assume]]` and `as<>` does no dynamic check — the codebase
convention wants `SLANG_RELEASE_ASSERT` or an explicit `if (empty) return;`; and a
persisting-crash BLOCK is vindicated the moment the author ships the exact guard
[debug-only assert before downcast is release-UB, not a nit](../learnings/1788249609417-approver-challenger-confirm-debug-only-slang-asser.md).
The complementary trap: a plausible-sounding "empty field list → bad MakeStruct"
argument is incomplete until you check the *consumer's* type guard — a
`SynthesizedStructDecl` lowers to an opaque intrinsic type, so `analyzeMakeStruct`'s
`as<IRStructType>` early-returns and the parity assert is never reached
[SynthesizedStructDecl empty fields ≠ reachable bug](../learnings/1788281637284-approver-challenger-miss-synthesizedstructdecl-in-.md).

## Revision diffing: comment-only, rebase, and carried gaps

Three atoms sharpen how to re-evaluate a revision. A comment/documentation-only
revision leaves every prior correctness concern live — diff the incremental patch
before crediting it, and a re-run primary "0 bugs" does not override two
independent tools persistently flagging the same core-purpose mechanism (that is
ABSTAIN, not approve)
[comment-only revision doesn't resolve a correctness flag](../learnings/1788348283179-approver-challenger-a-comment-only-revision-does-n.md).
A moved `diff_hash` on a synchronize can be a *pure rebase* — the compare between
head commits then includes every intervening master commit; scope your reading to
`gh pr diff` (base...head) content, and when it is byte-identical your prior
investigation transfers as confirmed
[synchronize with changed diff_hash can be a rebase](../learnings/1788380098940-approver-process-a-synchronize-with-a-changed-diff.md).
And a rebase can move the *leg* that actually carries a carried-over gap: re-run the
full mechanism trace (all coupled legs, not just the two cited lines) at the new
SHA, and treat a documented release-assert on an unproven-reachable path as
hardening, never a verified 🔴
[re-verify a carried gap's mechanism at each new head](../learnings/1788294032596-approver-challenger-miss-re-verify-a-carried-over-.md).

## When a gap IS a merge-precondition, and the docs editorial pass

Not every flagged test-gap is advisory. For a change to a liveness/dead-code
*marking* scheme, the reviewer-consensus bar is a two-directional regression test
with a genuine false-live positive control (one assertion that fails if live code
is dropped, one that fails if dead code is wrongly kept) — a human reviewer
demands it before merge, so flag its absence in the challenger, not as a nit
[two-directional liveness test is a merge-precondition](../learnings/1788301800371-approver-challenger-miss-validated-for-liveness-ma.md).
Finally, docs PRs need a probe the facts can't answer: a doc that verifies every
claim about `constexpr` against source was still CHANGES_REQUESTED because the
maintainer's objection was editorial — the feature is "implemented just barely
enough" for the core module and should be *discouraged*, not taught. Run an
editorial-appropriateness pass: is the feature meant to be user-facing, does the
section lead with the right stance, does it follow house style (no issue-tracker
links, future-error caveats)
[docs PR: factual accuracy ≠ editorial appropriateness](../learnings/1788379605633-approver-false-safe-docs-pr-factual-accuracy-edito.md).

**Source learnings (8):**

- [debug-only SLANG_ASSERT before an unchecked DeclRef downcast is a release-UB OPEN_GAP](../learnings/1788249609417-approver-challenger-confirm-debug-only-slang-asser.md) — #12828; SLANG_ASSERT→SLANG_ASSUME in release + as<> does no dynamic check; a persisting-crash BLOCK is vindicated when the author adds the exact guard; re-read policy_version every revision.
- [bot-authored type-legalization crash-fix merged unchanged — the safe shape](../learnings/1788257588030-approver-confirmed-safe-bot-authored-type-legaliza.md) — #12719; approvable when the path has a GPU-free positive-control test (crash→compiles), the new helper only narrows, and a switch case mirrors an existing twin.
- [SynthesizedStructDecl in a getDefaultVal field-owning predicate ≠ reachable bug](../learnings/1788281637284-approver-challenger-miss-synthesizedstructdecl-in-.md) — #12712; empty VarDecl fields but lowers to an opaque type, so analyzeMakeStruct's as<IRStructType> guard early-returns; trace the MakeStruct data type to the assert site.
- [Re-verify a carried-over gap's mechanism at each new head after a rebase](../learnings/1788294032596-approver-challenger-miss-re-verify-a-carried-over-.md) — #12136 R5; a rebase can move the leg carrying the gap; a documented SLANG_RELEASE_ASSERT on an unproven-reachable path is hardening, not a 🔴; never BLOCK on an unproven crash.
- [Two-directional test with a false-live positive control is a merge-precondition](../learnings/1788301800371-approver-challenger-miss-validated-for-liveness-ma.md) — #12607; for liveness/mark-encoding changes the bar is one assertion for each direction; a human reviewer demanded exactly this before merge.
- [A comment-only revision does NOT resolve a prior correctness flag](../learnings/1788348283179-approver-challenger-a-comment-only-revision-does-n.md) — #12840; diff the incremental patch; a re-run primary "0 bugs" never rounds up over persistent independent secondary correctness flags on the core purpose (ABSTAIN, not approve).
- [Docs PR: factual accuracy ≠ editorial appropriateness](../learnings/1788379605633-approver-false-safe-docs-pr-factual-accuracy-edito.md) — #12820 CHANGES_REQUESTED after WOULD_APPROVE; run an editorial pass: is the feature meant to be user-facing, does it lead with the right stance, does it follow house style.
- [A synchronize with a changed diff_hash can be a pure rebase](../learnings/1788380098940-approver-process-a-synchronize-with-a-changed-diff.md) — #12858; gh pr diff (base...head) content is authoritative, not diff_hash or compare/old...new; byte-identical content ⇒ prior investigation transfers as confirmed.
