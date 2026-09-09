---
title: Approver Review Probes — Verifying Claims, Citations, and Ledger Mechanics
type: concept
group: misc
tags: [approver, verification, docs-accuracy, git-citation, compare-api, record-decision, blob-identity, synchronize]
source_count: 8
---

## TL;DR

The second cluster of approver-challenger discipline: how to verify factual claims, cite code at a
pinned head, prove what a synchronize actually changed, and the immutable mechanics of the decision
ledger.

- **On an accuracy-of-text PR, the entire deliverable IS a set of factual claims** — verify EVERY
  one against primary source; "clearing" any as low-risk is skipping the review. "Not in the
  prelude" ≠ "unverifiable" (CUDA `__hXXX2` semantics live in `cuda_fp16.hpp`, on-disk — grep it).
- **A false documented invariant in a methodology tool is a blocking defect, even when the code is
  correct** — a comment stating a false growth/complexity property is what a future retuner reads
  and preserves.
- **A tool's output plus that tool's own restatement are ONE signal, not two.** Don't cite Devin +
  Devin's process report as independent corroboration.
- **A recalled learning describes code AS IT WAS WHEN WRITTEN.** A recall atom asserting "consumer X
  dereferences unguarded at file:line" is a decaying claim; open that file:line at the pinned head
  and re-verify. Recall is a pointer to WHERE to look, not a settled fact.
- **Cite pinned-head `file:line` from `git show <head_sha>:file`, never a local clone, a reviewer's
  suggested number, or a `git apply` reconstruction onto a divergent base** — the PR's own additions
  shift every number below the insertion point, and `git apply` fuzz-matches context so absolute
  numbers reflect whatever base you applied onto.
- **The GitHub `compare` endpoint caps `files[]` at 300** — never conclude "file X unchanged" from
  its file list; blob-compare the content SHA (`contents?ref=<sha>` or `git rev-parse <sha>:path`).
  A merge-only synchronize is settled by blob identity of the DECISIVE files (the changed file plus
  every file the gap's logic depends on), cheaper and more rigorous than a rebuild.
- **`record_decision` is append-only, first-write-wins per (repo, pr, commit_sha)** — you cannot
  re-record a corrected challenger for a commit you already recorded; get the text right the first
  time. The human verdict is joined automatically host-side; there is no `record_human_verdict` to
  call, and an ABSTAIN matching a human CHANGES_REQUESTED is corroboration, scoring N/A.
- **Pinning an error code in an EXISTING diagnostic test is a slot-replacement, not an addition** —
  the annotation matcher binds each diagnostic to the FIRST annotation, so replace a redundant slot,
  don't add a line; verify the swap left every diagnostic annotated.

## Verifying the deliverable when the deliverable is text

For a documentation/comment-accuracy PR the whole value is whether the claims match source, so
enumerate every factual assertion in the NEW text and verify each — do not stop at "most" and wave
the rest through. On slang#12652 a claim ("CUDA has no packed half divide") was cleared as
"unverifiable from the prelude," but it was verifiable one layer out: `__h2div` in the mounted
`cuda_fp16.hpp:2611-2623` calls scalar `__hdiv` twice — "not in the prelude" ≠ "unverifiable," and
CUDA `__hXXX2` intrinsic semantics live in the CUDA header, not the Slang prelude ([docs-accuracy
PRs: verify EVERY factual claim at
source](../learnings/1787692351637-approver-critique-mustfix-docs-accuracy-prs-verify.md)). The
same PR earlier taught that a false *documented invariant* in a methodology tool is blocking even
when the code is correct: on slang#12677 a comment claimed the new fma recurrence "keeps the linear
coefficient below 1 … as it was before," but the OLD form's `1.0009*acc` term compounds — the new
form is an improvement, not a preservation. In a file whose entire purpose is characterizing
generator growth, that false history-claim is the load-bearing artifact a future retuner relies on,
and "it's the author's comment / no runtime effect / dev-only tool" is not a clearing argument
([a false documented invariant in a methodology tool is a blocking defect, not a clarity
nit](../learnings/1787573172557-approver-critique-mustfix-a-false-documented-invar.md)). Both
atoms carry the same anti-pattern guard: a source plus that source's own restatement is one signal,
and when the critique gate holds a line across rounds on a point you keep re-excusing, re-examine
whether YOUR framing is the error.

Recalled learnings are pointers, not facts. On slang#12754 a recall atom asserted "a dropped
slang-glslang export is a silent dlsym-null crash — GlslangDownstreamCompiler dereferences `m_link`
unguarded at :426," but at the pinned head every consumer now guards every lookup (an omitted export
is a clean SLANG_FAIL). Consumer code hardens over time; a recall claim about a specific file:line
+ "unguarded" is decaying — open that line at the pinned commit before citing it. Recall's real
value is pointing at the right probes, not asserting current code state ([recalled learnings about
consumer code decay — re-verify null-guards against the pinned
head](../learnings/1787682888916-approver-challenger-miss-recalled-learnings-about-.md)).

## Citing code and proving what changed at a pinned head

A `file:line` citation is a claim about a specific commit's contents. On slang#12669 a citation from
a local master clone was wrong for the pinned head (the PR's own +168 lines moved the region down
~177 lines), and the "fix" — `git apply`-ing the PR diff onto a divergent base — was also wrong
because `git apply` matches by context with fuzz, landing content correctly but with absolute
numbers reflecting the applied-onto base. Get numbers from the actual commit: `git fetch origin
<head_sha>` then `git show <head_sha>:path | grep -n '<anchor>'` (the `contents?ref=<sha>` API
returns empty for files >1MB like `hlsl.meta.slang`, so `git show` on a fetched commit is the
reliable path) ([cite pinned-head line numbers via git show, not a local clone or a fuzz-applied
reconstruction](../learnings/1787693364267-approver-challenger-miss-cite-pinned-head-line-num.md)).

To prove whether a synchronize changed the code, blob-identity beats both the compare endpoint and a
rebuild. The GitHub `compare/OLD...NEW` endpoint caps its `files[]` array at 300, so an absence in
that list is not authoritative — blob-compare the content SHA of each decisive file at each ref
([correction: compare API is capped (300); blob-compare fix files; ABSTAIN is corroboration not
scored agreement](../learnings/1787581346760-approver-correction-correction-to-the-11387-synchr.md)).
On a merge-only synchronize, if `gh pr diff` shows a byte-identical diff, confirm master didn't
change the machinery by comparing git blob SHAs of the specific source files that determine the
behavior — the *changed file plus every file whose logic the gap depends on* — between the built
commit and the new head; identical blobs mean identical compiled behavior by construction, no
rebuild needed, and guard against rounding a repeated abstain up to APPROVE just because a
probabilistic reviewer drifted a severity label between identical revisions ([on a merge-only
synchronize, settle a prior gap by BLOB IDENTITY of the decisive files, not a
rebuild](../learnings/1787668555293-approver-process-on-a-merge-only-synchronize-settl.md)).

## Ledger mechanics and diagnostic-test slot replacement

`record_decision` is append-only, one row per (repo, pr, commit_sha), first-write-wins — a different
decision for the same commit is refused, so you cannot "re-record a corrected challenger"; the first
row is operative and a corrected rationale must be DISCLOSED as a stale operative row, never claimed
as "corrected ledger." "Decision recorded" is a generic ack, not proof the corrected text landed.
The human review verdict is joined automatically host-side (`record_human_verdict` is deliberately
not registered), and an ABSTAIN_POLICY row is excluded from agreement scoring — a match with a human
CHANGES_REQUESTED is corroboration, scoring N/A, never a scored "agreement." All three claims were
verified against the host source, not memory ([record_decision is first-write-wins + human verdict
is host-joined automatically](../learnings/1787583279256-approver-correction-record-decision-is-first-write.md)).

Finally, pinning an error code in an existing diagnostic test is a slot-replacement: the
`diagnostic-annotation-util` matcher marks each emitted diagnostic consumed by the FIRST annotation
that binds it (message OR severity OR errorCode, never a conjunction), so you cannot ADD an
`^ error E#####` line — you'd have one more annotation than diagnostic rows and fail. Replace a
redundant slot, keep the detailed-message line, and verify the swap left every diagnostic annotated
(coverage strictly ≥ before). Code-only annotations are legitimate when primary + span messages
render identically; and a novelty/coverage claim about diagnostics must grep message text too, since
grepping only the code literal undercounts message-only coverage ([pinning an error code in an
EXISTING diagnostic test is a slot-replacement, not an
addition](../learnings/1787587257219-approver-clause-gap-pinning-an-error-code-in-an-ex.md)).

**Source learnings (8):**
- [a false documented invariant in a methodology tool is a blocking defect, not a clarity nit](../learnings/1787573172557-approver-critique-mustfix-a-false-documented-invar.md) — a comment stating a false growth-property is the load-bearing artifact a retuner preserves.
- [Pinning an error code in an EXISTING diagnostic test is a slot-replacement](../learnings/1787587257219-approver-clause-gap-pinning-an-error-code-in-an-ex.md) — the matcher binds first-annotation-wins; replace a slot, don't add a line; grep message text for coverage claims.
- [correction: compare API is capped (300); blob-compare fix files; ABSTAIN is corroboration](../learnings/1787581346760-approver-correction-correction-to-the-11387-synchr.md) — never assert absence off a truncated compare page; blob-compare content SHA per ref.
- [record_decision is first-write-wins + human verdict is host-joined automatically](../learnings/1787583279256-approver-correction-record-decision-is-first-write.md) — get the challenger text right on the first call; there is no re-record and no record_human_verdict.
- [Recalled learnings about consumer code decay — re-verify null-guards against the pinned head](../learnings/1787682888916-approver-challenger-miss-recalled-learnings-about-.md) — recall is a pointer to where to look, not a settled fact about current code.
- [Docs-accuracy PRs: verify EVERY factual claim at source, don't "clear" an unverifiable one](../learnings/1787692351637-approver-critique-mustfix-docs-accuracy-prs-verify.md) — "not in the prelude" ≠ "unverifiable"; a tool + its own restatement are one signal.
- [Cite pinned-head line numbers via git show, not a local clone or a fuzz-applied reconstruction](../learnings/1787693364267-approver-challenger-miss-cite-pinned-head-line-num.md) — `git show <head_sha>:file`; contents API is empty for files >1MB.
- [On a merge-only synchronize, settle a prior gap by BLOB IDENTITY of the decisive files](../learnings/1787668555293-approver-process-on-a-merge-only-synchronize-settl.md) — identify decisive files honestly; a label drift is not new evidence.
