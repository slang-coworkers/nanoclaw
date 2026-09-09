---
title: Devin head-currency and staleness on the fallback/Devin-only tier
type: concept
group: review-process
tags: [approver, devin, staleness, head-current, fallback-tier, synchronize, abstain, stale-stage]
source_count: 14
---

## TL;DR

On the slang/slangpy PR-approver's fallback and Devin-only tiers, Devin is often the SOLE
external review signal — so whether its analysis actually covers the pinned head is a
first-class correctness question, not a detail. The recurring failure: `devin-fetch.sh`
exits 0 and shows a clean or plausible verdict, but Devin cached the analysis of a
SUPERSEDED revision (after a rebase, squash, force-push, re-scope, or `synchronize`).
Exit 0 means "the page was scraped," never "the analysis is head-current."

Core rules, all learned the same way (a codex critique gate caught the stale trust):

- **Verify head-currency before trusting any Devin verdict.** Three cheap, mechanical checks:
  (1) `devin-commit-status.txt` must literally say "Analysis is up to date" — `"unknown"`,
  "out of date", "behind" all mean unconfirmed; (2) the analysis PROSE must describe the
  current head's mechanism (grep for a token unique to this revision); (3) every file:line
  Devin cites must exist in `gh pr diff` / the file at the pinned SHA. Any miss ⇒ stale.
- **"unknown" is a scrape failure, not a staleness verdict, and NOT confirmation of currency**
  — treat it as CHALLENGER_INCOMPLETE and re-run.
- **The "Analysis is up to date" banner can LIE.** Devin re-scrapes the PR *body* (current) but
  its diff-level *finding cards* can lag a force-push; cross-check the cards' cited files
  against the head diff's file set even when the banner is green.
- **A stale sole-signal is the ABSTAIN condition itself.** "Devin is head-stale" ⇒
  `reviewers_complete=false` ⇒ ABSTAIN_POLICY (STALE_STAGE / NO_REVIEW_SIGNAL). Diagnosing
  the instrument as not-head-current already decides the case — do NOT then substitute your
  own source read for the missing review and round up.
- **Repair before you abstain if you can.** `devin-fetch.sh` has no force/refresh flag; clear
  the browser state (`agent-browser close --all` + `rm -rf /tmp/agent-browser-*`) and re-fetch,
  or just re-run after a short wait — Devin usually refreshes on a second pass.
- **A fix commit that closes prior-round gaps is not "now clean."** Re-derive from the new head:
  verify the fixes AND re-challenge the new code; a doc-🔴 on code the revision DELETED is stale,
  not a live block.
- **Commit_match passing is necessary but not sufficient on the Devin-only tier** — it passes by
  convention (Devin assumed head-current), so only the content cross-check catches a stale Devin.

## Why Devin staleness dominates the fallback tier

Devin caches its review per PR URL and does not re-analyze on every fetch. `devin-fetch.sh`
(in `nanoclaw-pr-review-runner/scripts`) only opens the Devin review page and scrapes whatever
is currently rendered; it has **no force/refresh/no-cache flag** and the Devin Review MCP that
would trigger a truly fresh analysis is not in the approver container's tool allowlist
([devin-fetch has no force flag](../learnings/1786692089001-approver-infra-abstain-devin-fetch-has-no-force-fl.md)).
So after any head-moving event the scrape can return an analysis pinned to the commit Devin
first saw. This bites hardest on the **Devin-only tier** (bot-authored `fix/issue-N` /
Claude-branch PRs, where production `claude-code-action` review is skipped and harvest exits 20),
because there Devin is the *only* head-current review signal — a stale Devin means there is no
independent review signal at all, and the skill is explicit that the approver's own
source-inspection is the CHALLENGER, which "can only add caution, never substitute for a missing
review signal or upgrade a verdict"
([Devin-only commit_match passes by fiat](../learnings/1787072023468-approver-infra-abstain-devin-only-tier-commit-matc.md)).

The trap has one shape across a dozen PRs: exit 0 + a clean-looking or plausible verdict, on an
analysis that describes the *previous* revision. Concrete instances:

- **slang-rhi#797** re-opened as a materially smaller 2-file change after being parked to draft;
  the re-fetch returned Devin's cached analysis of the OLD batched-resolve design whose cited
  symbols (`m_pendingTimestampQueryResolves`, `kMaxPendingTimestampQueryResolveRanges`) appear
  nowhere in the current diff
  ([a Devin exit-0 run can be CACHED-STALE](../learnings/1786694505500-approver-challenger-miss-a-devin-exit-0-run-can-be.md)).
- **slangpy#1107** rebased+squashed ~3 min after `ready_for_review`; two Devin runs both returned
  the pre-synchronize analysis, and it produced a plausible, source-verifiable 🔴 — which is the
  subtlest form, because verifying the *finding* is true at head does not repair the *provenance*
  being broken
  ([Devin returns a CACHED pre-synchronize analysis](../learnings/1786704357732-approver-infra-abstain-devin-returns-a-cached-pre-.md),
  [a plausible source-verifiable 🔴 can rest on a STALE review](../learnings/1786704381826-approver-challenger-miss-a-plausible-source-verifi.md)).
- **slang-rhi#841 R2** and **slang#12410 R2**: on a `synchronize` the first Devin capture read the
  PRIOR head — with "Loading diffs…" still on the page, "Checks 1/2", and commit-status "unknown" —
  and re-flagged bugs the very fix commit had already closed; the fresh re-capture showed "Analysis
  is up to date / Checks 2/2" with the current line numbers
  ([Devin's first post-push capture can be STALE — date it by commit-status](../learnings/1786805624924-approver-challenger-miss-on-a-synchronize-devin-s-.md),
  [verify HEAD-CURRENT before trusting the 0-bugs signal](../learnings/1787297274879-approver-infra-on-the-devin-only-tier-verify-the-f.md)).

## The discriminating probes (cheap, deterministic)

Never judge currency by exit code or the headline count. The transferable probes, in rough
order of sharpness:

1. **A file the change added or dropped** is the sharpest discriminator: if Devin cites a file
   present at the old head but 404 at the pinned head (or vice-versa), the analysis is stale.
   slangpy#1107's Devin cited `test_filter_lsan_reports.py`, present at `ba6d45bc` but gone at
   the pinned `0ab6de37`
   ([cross-check a dropped/added file](../learnings/1786704357732-approver-infra-abstain-devin-returns-a-cached-pre-.md)).
2. **Line numbers / identifiers vs the pinned-head source.** slang#12194's Devin cited
   `isStageOnlyRequirement` at 161-171 describing a one-way non-filtering shape — but the head had
   moved it to 172-181 and reworked it to bidirectional (the fix for a reviewer comment); the
   citation matched the PARENT commit exactly
   ([commit_match passes by fiat](../learnings/1787072023468-approver-infra-abstain-devin-only-tier-commit-matc.md)).
   On slang#12537 R2, Devin used the PRE-RENAME identifier `hasRegisteredPayloadWriteback` that no
   longer existed at head
   ([exit 0 is NOT head-current](../learnings/1787882263271-approver-infra-abstain-devin-fetch-exit-0-is-not-h.md)).
3. **File-count / ±line totals vs `gh api compare/main...<pinned>`** or `gh pr view --json
   changedFiles,additions,deletions` — a re-scoped PR changes the diff shape (slang#12548 R2 went
   from 2-file to 1-file test-only; Devin still showed the R1 two-card shape)
   ([Devin serves a CACHED analysis of an OLD revision](../learnings/1787573701204-approver-challenger-miss-devin-serves-a-cached-ana.md)).
4. **A finding that describes a shape the head already reworked** is itself the tell — the head's
   own diff tells you what changed; if Devin talks about the pre-diff shape, it did not see the diff.
5. On a revision-chain re-gate, the analysis prose can still describe an EARLIER commit even when the
   page metadata shows the new commit count — slang#12716's Devin said "three files touched" while the
   page read "6 files / 2 commits"
   ([Devin's scraped analysis can lag the PR head even at exit-0](../learnings/1787706500193-approver-challenger-miss-devin-s-scraped-analysis-.md)).

**The banner is not enough.** slang#12666 is the sharpest counterexample: `devin-commit-status.txt`
read "Analysis is up to date" and a fresh re-run returned the SAME stale finding cards under the
SAME banner — cards citing `slang-session.cpp` lines from a reverted intermediate revision the head
had moved to `slang-emit-dependency-file.cpp`. Devin re-scrapes the PR body (current) but its
diff-level findings lag force-pushes/reworks, so you must cross-check the cards' cited files against
`gh pr diff --name-only` even when the banner is green
([the "Analysis is up to date" banner can LIE](../learnings/1787352628706-approver-infra-abstain-devin-s-analysis-is-up-to-d.md)).
Conversely, an `"unknown"` marker is a *scrape failure* of the freshness popover (not a staleness
diagnosis) but also NOT confirmation of currency — re-run until the popover renders a definite
status, and **re-read `devin-flags.md` after every re-run because it is overwritten in place**
([an "unknown" freshness marker is CHALLENGER_INCOMPLETE](../learnings/1787597813153-approver-process-an-unknown-devin-freshness-marker.md)).
Residual cosmetic lag exists too: Devin's inline informational-nit line anchors can stay pinned to
old line numbers even when the analysis body and verdict are head-current — judge currency by the
body + commit-status, not the nit anchors
([verify HEAD-CURRENT before trusting 0-bugs](../learnings/1787297274879-approver-infra-on-the-devin-only-tier-verify-the-f.md)).

## The decision rule: stale sole-signal IS the abstain — do not round up

The single most important calibration lesson: once you diagnose your review signal as
not-head-current on a tier where it is the only signal, **the decision is already an abstain**.
Continuing to a positive verdict on your own source read is substituting the challenger for the
missing review tier, which the procedure forbids ("investigation can only add caution, never
upgrade"). slang#12417 R2 is the worked correction: the author noted a Devin doc-🔴 keyed to code
the revision REMOVED was "stale, not a live block" — true about that individual bug — and then used
it to drive toward WOULD_APPROVE; DECISION_REVIEW reversed to ABSTAIN, because "the review signal is
stale" is itself the abstain condition
([on a re-synchronized PR Devin's analysis can lag](../learnings/1787328460752-approver-challenger-on-a-re-synchronized-pr-devin-.md),
["Devin is head-stale" is the ABSTAIN condition, not a license to approve](../learnings/1787329088831-approver-critique-mustfix-devin-is-head-stale-is-t.md)).
A strong human approval at the exact head does NOT rescue it — the human verdict is join/calibration
data, not a review input (see the approver-decision-policy page); abstaining loses nothing when the
human already approved, while approving on a stale signal is an unearned positive claim.

**Repair before abstaining when you can.** Because staleness is often a scrape artifact, the fix for
the SIGNAL is a fresh head-current Devin, not a challenger override: clear the browser profile and
re-fetch (slang-rhi#797's re-fetch ~20 min later returned the real head-current 2-file analysis,
0/0), or just re-run after a short wait
([re-fetch with cleared browser profile catches up to head](../learnings/1786692089001-approver-infra-abstain-devin-fetch-has-no-force-fl.md)).
Only if the re-fetch still can't reach head do you record STALE_STAGE / NO_REVIEW_SIGNAL, naming the
artifact. On a `synchronize` where the base moved, first check whether the PR's own blobs even
changed (per-file sha256) before assuming there is new work to re-analyze.

**Burn-down signal.** Devin freshness on reworked/force-pushed PRs is a genuine tooling gap, not a
policy abstain — every bot-authored `fix/issue-N` PR will keep forcing infra-abstains until
`devin-fetch` pins/verifies the analyzed commit against the head. Flag it to the Devin-runner owner
and record NO_REVIEW_SIGNAL as an infra-family code, distinct from an OPEN_GAP policy abstain
([the "up to date" banner can be wrong after a force-push](../learnings/1787352628706-approver-infra-abstain-devin-s-analysis-is-up-to-d.md)).

**Source learnings (14):**

- [devin-fetch has no force flag; re-fetch with cleared browser profile catches up to head](../learnings/1786692089001-approver-infra-abstain-devin-fetch-has-no-force-fl.md) — slang-rhi#797 returned a cached superseded-revision analysis; clearing agent-browser state and re-fetching forced a head-current re-render.
- [A Devin exit-0 run can be CACHED-STALE — verify its cited symbols exist in the current diff](../learnings/1786694505500-approver-challenger-miss-a-devin-exit-0-run-can-be.md) — after a self-park→re-open, exit 0 described the old batched-resolve design; on a Devin-only tier a stale Devin is no head-current review signal at all.
- [Devin returns a CACHED pre-synchronize analysis after a rebase+squash — verify its head](../learnings/1786704357732-approver-infra-abstain-devin-returns-a-cached-pre-.md) — slangpy#1107; the sharpest discriminator is a file the sync added/dropped, plus totals vs `gh compare`.
- [A plausible, source-verifiable 🔴 can still rest on a STALE review](../learnings/1786704381826-approver-challenger-miss-a-plausible-source-verifi.md) — confirming a finding is true at head does not repair broken provenance; establish the reviewer's head FIRST, then weigh findings.
- [On a synchronize, Devin's first post-push capture can be STALE — date it by commit-status](../learnings/1786805624924-approver-challenger-miss-on-a-synchronize-devin-s-.md) — slang-rhi#841 R2 re-flagged already-fixed bugs; tells were "Loading diffs…", "Checks 1/2", commit-status "unknown".
- [Devin-only tier commit_match passes by fiat — a STALE Devin is only caught by cross-checking cited lines](../learnings/1787072023468-approver-infra-abstain-devin-only-tier-commit-matc.md) — slang#12194 Devin cited parent-commit line numbers; commit_match is satisfied by convention, not evidence.
- [On the Devin-only tier, verify the fetched review is HEAD-CURRENT before trusting its 0-bugs signal](../learnings/1787297274879-approver-infra-on-the-devin-only-tier-verify-the-f.md) — slang#12410 R2; three checks (commit-status, prose token, no removed-file citations); nit anchors are cosmetic, judge by body.
- [On a re-synchronized PR, Devin's analysis can lag — a doc-🔴 on code the revision REMOVED is stale](../learnings/1787328460752-approver-challenger-on-a-re-synchronized-pr-devin-.md) — slang#12417 R2; cross-check every Devin citation against `gh pr diff` + the pinned-SHA file.
- ["Devin is head-stale" is the ABSTAIN condition itself — not a license to approve on your own source read](../learnings/1787329088831-approver-critique-mustfix-devin-is-head-stale-is-t.md) — the correction to the prior atom; a proven-spurious doc-🔴 resolves to ABSTAIN, never a silent upgrade; a human approve does not round it up.
- [Devin's "Analysis is up to date" banner can LIE — verify its finding cards cite files the head diff touches](../learnings/1787352628706-approver-infra-abstain-devin-s-analysis-is-up-to-d.md) — slang#12666; a fresh re-run returned the same stale cards under a green banner; cross-check card files against `gh pr diff --name-only`.
- [Devin serves a CACHED analysis of an OLD revision — check commit-status + diff-shape](../learnings/1787573701204-approver-challenger-miss-devin-serves-a-cached-ana.md) — slang#12548 R2 re-scoped 2-file→1-file test-only; Devin showed the old two-card shape and cited a TEST_INPUT block gone at head.
- [An "unknown" Devin freshness marker is CHALLENGER_INCOMPLETE, not clean — re-run and re-read devin-flags.md](../learnings/1787597813153-approver-process-an-unknown-devin-freshness-marker.md) — slang#12693; "unknown" is a popover scrape failure; devin-flags.md is overwritten in place on every re-run.
- [Devin's scraped analysis can lag the PR head even at exit-0 — re-run and assert head-currency](../learnings/1787706500193-approver-challenger-miss-devin-s-scraped-analysis-.md) — slang#12716; analysis prose said "three files" while metadata showed 6 files/2 commits; exit 0 ≠ finished re-analyzing.
- [devin-fetch exit 0 is NOT head-current, and the parsed devin-flags.md can silently drop flags](../learnings/1787882263271-approver-infra-abstain-devin-fetch-exit-0-is-not-h.md) — slang#12537 R2; pre-rename identifier + old line numbers + "unknown" status ⇒ NO_REVIEW_SIGNAL; also cross-check the raw page's "N Bugs/M Flags" header.
