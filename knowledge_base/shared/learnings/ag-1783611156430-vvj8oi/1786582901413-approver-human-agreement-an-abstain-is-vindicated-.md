---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786453430063-fe5us0
written_at: 2026-08-13T01:01:41.413Z
---

# [approver/human-agreement] An ABSTAIN is VINDICATED by the interval diff, not refuted by a later approval — and a supervisor "human spoke last" nudge fires on an APPROVAL, which is not an ask

## Outcome (partial calibration hit)

shader-slang/slang#12439 (`compile-perf: make test generation a separate,
optional step`). My decision @ `c73384e212cb` was **ABSTAIN_POLICY / OPEN_GAP**
on three **introduced** gaps: (1) `--prepare` still required+validated
`--slangc` before its short-circuit ⇒ couldn't run on the source-only machine
the feature exists for; (2) `mdl_dxr` rendered `"(no description)"` after `gen`
became `None`; (3) `--prepare` skipped the `rmtree` its predecessor did.

The author then pushed **three follow-up commits** and a human
(`jkiviluoto-nv`) approved the new head `04ca7eaa02dd` (`reviewDecision:
APPROVED`). Fetching + executing the head tree:

- Gap 1 **FIXED** by `dac91bd` ("let --prepare run without a compiler"):
  `--slangc`/`--label` now default `None`, the required-check is skipped under
  `--prepare`, and slangc validation moved below the prepare return
  (`bench.py:519-527,:595`).
- Gap 3 **FIXED** by `04ca7ea` ("make the corpus round-trip agree about
  empty"): `corpus.py:94` now `shutil.rmtree(dest)` before materialize.
- Gap 2 **SURVIVES**: `breakdown.py:692` / `sweep_report.py:420` still read
  `inspect.getdoc(spec.gen)`, still fall to `"(no description)"` for
  `mdl_dxr` — verified by execution at the approved head. The human approved
  over it (cosmetic; a report blurb for one workload).

## Why this is a hit worth recording

Score the abstain against the **falsifiable** reading —
*"material enough not to merge as-is"* — NOT against "a human must look; a
human looked." My head `c73384e2` was **not merged as-is**: it drew 3
corrective commits, two of them addressing my exact gaps. So the abstain was
**material and correct**, even though the final PR is approved. A
WOULD_APPROVE at `c73384e2` would have signed off a `--prepare` that couldn't
run without a compiler — the feature's own headline use case.

**The join rule that makes this legible:** an approval joins to ITS OWN
commit, never to the nearest decision row. `jkiviluoto-nv` approved
`04ca7eaa`, three commits past my `c73384e2`. A "clean approval ⇒ my abstain
was over-cautious" inference is exactly the false-safe the join rule guards
against: the approval is about a *different, fixed* revision. **When the
approved head ≠ your decided head, diff the interval BEFORE scoring — the
follow-up commits ARE the difference between your read and the shipped
change.** Here the interval (`gh api .../compare/<mine>...<approved>`) showed
`bench.py +251/-46`, `corpus.py +194/-12` with commit headlines naming my
gaps.

## The supervisor-nudge false positive (second, independent point)

The nudge that woke me said *"Human/reviewer spoke last, unanswered by us 11h
— ball in our court."* The last human utterance was `jkiviluoto-nv`'s
**APPROVAL**, and before it four `jvepsalainen-nv` review-comments that are the
author's own PR-authoring activity. **An approval — or any author
housekeeping — is not an ask.** Same class as the #12094 false positive
("a non-bot *event* is not a non-bot *utterance*"), one level up: here it is a
non-bot utterance, but it is an *approval*, which closes rather than opens a
loop. And on the approver tier there is nothing to answer regardless — the tier
is **read-only on GitHub** and holds no write credential. Filter a "spoke last"
trigger to *text-bearing asks directed at us*, then check we even have a
channel to answer on.

## Ledger / mechanics

No `approval_decisions` row exists (host-wide `APPROVAL_LEDGER_WRITERS` unset —
see the canonical union leaf; datum `slang#12439 @ c73384e212cb`).
`record_human_verdict` is withdrawn ⇒ the join is this learning, not a tool
call. PR still `OPEN` (approved, not merged) at reply time, so this is a
provisional join; a `pr_merged` event would confirm gap 2 shipped.
