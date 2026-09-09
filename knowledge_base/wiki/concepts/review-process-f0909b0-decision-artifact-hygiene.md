---
title: Decision-artifact hygiene — clause ordering, prior/posterior separation, and instrument verification
type: concept
group: review-process
tags: [eval-clauses, tier-eligible, review-doc, stale-stage, negative-grep, record-decision, output-review, critique-gate, approver]
source_count: 7
---

## TL;DR

The approver's decision is a set of artifacts (`review-doc.md`, `investigation.md`,
`decision.md`, the ledger row, the delivered message) audited by a two-tier critique
gate (DECISION_REVIEW + OUTPUT_REVIEW). These atoms are the hygiene that keeps those
artifacts honest:

- **The workflow step order is a data dependency, not a suggestion.** Run
  `eval-clauses.py` AFTER synthesizing `review-doc.md` — `commit_match` reads the
  doc's embedded result, so running early manufactures a spurious
  `CLAUSE_UNEVALUABLE → ABSTAIN_INFRA`. An `ABSTAIN_INFRA` naming an artifact *you
  write yourself* is self-inflicted until re-run in order.
- **Keep the prior and the posterior physically separate.** The review doc is the
  PRIOR (harvested external signal only); the challenger investigation is the
  POSTERIOR. Appending your own findings into the review doc and then parsing a
  verdict out of it *launders your reasoning into the verdict* — a reader can't tell
  whether `gaps:0` came from a reviewer or from you. Challenger output goes in
  `investigation.md`, always.
- **A review INPUT captured after the outcome landed is a Step-2 integrity failure.**
  `STALE_STAGE` outranks any challenger finding (Step 2 short-circuits before Step 3).
  Timestamp the *input* artifacts, never a file you are still editing.
- **A correction is complete at the negative grep, not the edit.** A citation is a
  pointer to a *belief*, not a bounding box on the defect; the belief hides in
  headings, JSON values, summaries, and your memory store.
- **Verify the instrument, not its return string.** `record_decision` returns
  "Decision recorded" while the host denies the write (`APPROVAL_LEDGER_WRITERS`
  unset) — verify the capability, and OUTPUT_REVIEW audits every artifact for
  source-accuracy, so an imprecise supporting sentence blocks delivery even for a
  sound decision.
- **A size-cap clause measures bytes moved, not authorship** — vendored third-party
  code trips `tier_eligible` while buying no review signal; split the churn by path
  and name the vendored split in the abstain.

## Clause ordering and the size cap

`commit_match` and the `diff_hash` it reports read the synthesized `review-doc.md`.
On slang#12136 running `eval-clauses.py` *before* writing the doc produced
`UNEVALUABLE=['commit_match'] → ABSTAIN_INFRA` — "the script was right, my sequencing
was wrong; nothing was broken, I had asked a question about an artifact I had not
created yet". The general form: "an `unevaluable` verdict is a claim about the INPUTS
I supplied as much as about the system — an infra-abstain asserts data that should
have been staged is absent, and if I am the one who was supposed to stage it, that
assertion is about me". The cheap tell: **an ABSTAIN_INFRA naming an artifact I write
myself (vs one GitHub/CI/a bot produces) should be assumed self-inflicted until re-run
in order** [Run eval-clauses.py AFTER synthesizing review-doc.md](../learnings/1786400629194-approver-clause-gap-run-eval-clauses-py-after-synt.md).

The `tier_eligible` size cap is the most abstain-productive clause, and it measures
`additions+deletions` with **no notion of authorship**. On slangpy#1050 it FAILed at
12652 lines, but 7644 (60%) were vendored upstream sources (`external/bc7enc/*`,
`external/include/bcdec.h`) dropped in wholesale; the *authored* surface was ~5000,
comfortably under the cap. "A vendoring PR is the worst case: the churn is large and
simultaneously the least review-relevant." Split the churn by path before reporting
the abstain as a huge change (`gh api …/compare/<base>...<sha> --jq '.files[] |
"\(.additions+.deletions)\t\(.filename)"' | sort -rn`), and name the split — "12652
total, ~5000 authored" tells the human something very different. CodeRabbit already
encodes the right distinction (`.coderabbit.yaml` `!external/**`), so the eventual fix
should mirror the repo's own review config [Vendored third-party code blows the size cap and buys no review signal](../learnings/1786376508565-approver-clause-gap-vendored-third-party-code-blow.md).

## Prior vs posterior, and stale stages

The approver both *builds* the review doc and *parses a verdict from* it — two roles
for one file, distinguished only by a heading. On slangpy#1099 appending
`## Approver challenger findings` to `review-doc.md` and then reading `gaps:0` out of
it collapsed review → parse → challenger into one step; "the doc is supposed to be the
PRIOR (harvested external signal only); appending the posterior into the prior makes
the verdict stop being auditable". The check: "would this line still be in this file
if I had never reasoned about the PR? If no, it doesn't belong in the review doc" —
challenger output goes in `investigation.md`, and the contamination was **load-bearing**
(contaminated `gaps:0` vs clean `gaps:1`) [Writing your own findings into the review doc launders them into the verdict](../learnings/1786437419483-approver-critique-mustfix-writing-your-own-finding.md).

When the PR outcome lands *during* the decision, a review input drawn from an
already-terminal PR fails Step 2's harness-integrity check — and Step 2 short-circuits
before Step 3's challenger runs. On slang-rhi#826 R2 the correct state was
`ABSTAIN_INFRA:STALE_STAGE`, not the substantive `OPEN_GAP` the author preferred:
"which finding I consider most interesting has no bearing on which state the procedure
yields — record STALE_STAGE and relay the OPEN_GAP as a secondary observation". Two
checks: distinguish which artifact is late (a late *write-up* is recoverable; late
*evidence* means the stage is dirty), so timestamp the **input** artifacts and prefer
clock-independent proof (the capture literally contained the string `Merged`); and
**never cite the mtime of a file you are still editing** — every subsequent edit
falsifies the table, "a self-invalidating measurement is worse than no measurement
because it reads as verified". Ledger mechanic: a *denial is not a row*, so a corrected
state can be re-recorded when the prior attempt was refused [a review INPUT captured after the PR merged is a Step-2 integrity failure — STALE_STAGE outranks any challenger finding](../learnings/1786413428482-approver-infra-abstain-a-review-input-captured-aft.md).

## Corrections and instrument verification

A correction is complete at the **negative grep**, not the edit. In one slang#12450
review the critique gate had to re-flag the same three corrections three times because
each edit fixed the cited line and left an identical copy of the false belief
elsewhere — "a citation is a pointer to a belief, not a bounding box on the defect".
The copies hide preferentially in surfaces that don't read like prose: **headings**
(feel like structure), **JSON/YAML values** (feel like data), **summary tables/
abstracts** (written earliest from the wrong premise), and **the memory file** (the
worst case, read as fact by the next session). "Report the sweep, not the edit: 'fixed
at line N, and grepped the artifact set for `<pattern>` — zero remaining hits outside
the correction notes' is checkable; 'fixed' is not" [Fixing the line you were pointed at is not fixing the claim — re-grep for its other phrasings](../learnings/1786387907886-approver-critique-mustfix-fixing-the-line-you-were.md).

Instruments report their own success without their write landing. On slang#12084 (and
independently on slang-rhi#822) `record_decision` returned "Decision recorded" while
the host emitted, on a separate channel, "record_decision denied: no approval-ledger
writers are configured" — no ledger row was created because the tool returns after
*enqueueing*, not after host persistence. "⭐ VERIFY THE CAPABILITY, NOT THE RETURN
STRING" — and if counting instances, quote the PR list or a rate, not a file count
(the file count is self-referential — documenting the defect grows it). The same
session records: the stale nanoclaw `devin-fetch.sh` is Bugs-blind and can miss a Bug
entirely (use the slang copy, `bash <path>` since it is mode 644); "A SUBAGENT'S CLAIM
ABOUT A FILE IS NOT A READING OF THE FILE" (a relayed mechanism description was wrong);
and the critique gate `gate-critique-on-deliver.sh` text-matches any `gh api …pulls`
as PR-creation, denying read-only evidence gathering — use the MCP GitHub tools or
`gh pr view --json`, and finish memory writes BEFORE the OUTPUT_REVIEW round
[Two silent instrument failures: record_decision success on a host-denied write, and the stale nanoclaw devin-fetch.sh](../learnings/1786458774421-approver-infra-abstain-two-silent-instrument-failu.md).

OUTPUT_REVIEW audits **every artifact** for source-accuracy, not just the decision. On
slang#12490 the DECISION_REVIEW passed but OUTPUT_REVIEW returned must-fix three times
on factual precision in the deliverable: an unverifiable process self-reference ("ledger
recorded + DECISION_REVIEW approved" — quote the runtime receipt instead), a wrong CLI
flag name (grep the option table at head, don't recall it), and a stack-vs-heap slip
("the thunk builds everything on the stack" is false — slang `List<>` buffers heap-
allocate; the guarantee is call-scoped + non-retained + reserved-so-pointers-stable).
"A sound decision does not shield an imprecise supporting sentence, and a correction
applied to one artifact but not its siblings just yields the same must-fix next round"
[OUTPUT_REVIEW audits every artifact for source-accuracy, not just the decision](../learnings/1786610771626-approver-critique-mustfix-output-review-audits-eve.md).

**Source learnings (7):**

- [Vendored third-party code blows the size cap and buys no review signal](../learnings/1786376508565-approver-clause-gap-vendored-third-party-code-blow.md) — `tier_eligible` sums bytes moved with no authorship notion; split the churn by path and name the vendored split in the abstain; mirror `.coderabbit.yaml`'s `!external/**`.
- [Fixing the line you were pointed at is not fixing the claim — re-grep for its other phrasings](../learnings/1786387907886-approver-critique-mustfix-fixing-the-line-you-were.md) — a citation is a pointer to a belief; copies hide in headings, JSON values, summaries, and the memory store; a correction is complete at the negative grep.
- [Run eval-clauses.py AFTER synthesizing review-doc.md](../learnings/1786400629194-approver-clause-gap-run-eval-clauses-py-after-synt.md) — `commit_match` reads the doc; an `unevaluable` verdict is a claim about the inputs I supplied; an ABSTAIN_INFRA naming an artifact I write myself is self-inflicted until re-run in order.
- [a review INPUT captured after the PR merged is a Step-2 integrity failure — STALE_STAGE outranks any challenger finding](../learnings/1786413428482-approver-infra-abstain-a-review-input-captured-aft.md) — Step 2 short-circuits before Step 3; timestamp input artifacts not a file you're editing; a denial is not a row.
- [Writing your own findings into the review doc launders them into the verdict](../learnings/1786437419483-approver-critique-mustfix-writing-your-own-finding.md) — the doc is the prior (external signal only), the investigation is the posterior; contaminated `gaps:0` vs clean `gaps:1` was load-bearing.
- [Two silent instrument failures: record_decision success on a host-denied write, and the stale nanoclaw devin-fetch.sh](../learnings/1786458774421-approver-infra-abstain-two-silent-instrument-failu.md) — verify the capability not the return string; quote a PR list/rate not a file count; a subagent's claim about a file is not a reading of it; the critique gate over-blocks read-only `gh api pulls`.
- [OUTPUT_REVIEW audits every artifact for source-accuracy, not just the decision](../learnings/1786610771626-approver-critique-mustfix-output-review-audits-eve.md) — factual imprecision in the supporting doc blocks delivery; grep CLI flags at head; never say "stack" for slang heap-allocating containers; fix a phrasing across all sibling artifacts together.
