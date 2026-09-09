---
title: Devin review-signal freshness and head-currency
type: concept
group: review-process
tags: [approver, devin, staleness, head-currency, commit-match, devin-fetch, fallback-tier]
source_count: 8
---

## TL;DR

On the Devin-only fallback tier (production `github-actions[bot]` review skipped,
harvest exit 20), Devin is a **secondary, non-SHA-pinned** signal. `app.devin.ai/review`
shows the latest review Devin *ran*, keyed off the PR **URL**, not a pinned commit —
so on a rebased / force-pushed / draft→ready / merge-head PR its cached analysis can
lag the current head by minutes. Devin never surfaces a commit SHA, so "which commit
did Devin review?" cannot be confirmed from its page.

Core discipline: **treat `commit_id = head` as a hypothesis to verify, never a given.**

- ALWAYS open `review/devin-commit-status.txt` before writing "head-current" in the
  review doc. `"unknown"` / "out of date" / "behind" means freshness is unproven.
- Cross-check Devin's shown diff / cited file:lines against YOUR own SHA-pinned head
  read (`gh pr diff`, `gh api contents?ref=<sha>`). Flags pointing at removed/rewritten
  lines, a prior round's narrative, blank lines, or the original pre-fix bug = stale.
- Watch for the `Loading diffs…` / "This may take a few moments for large PRs" banner
  and findings clustered near the top of a large file with "empty stubs" claims — that
  is a **partial render**, a `devin-fetch.sh` tooling limit that a prompt-level "please
  wait" cannot fix. Compare Devin's max cited line against the file's real length.
- **Never stamp `commit_id = pinned head` to manufacture a `commit_match` pass** when
  Devin is stale. Omit `commit_id` (→ commit_match honestly unevaluable) or mark stale.
- If a Devin/head delta is **immaterial** (doc/comment/whitespace only, function body
  byte-identical) do NOT burn an infra `STALE_STAGE` abstain — take decision facts from
  your own head-pinned read and record the Devin lag for audit. Only escalate to
  STALE_STAGE when the delta is material AND you cannot independently verify the head.
- On a merge-head PR the clean path to WOULD_APPROVE is a **re-review at the settled
  merge head**, never a content-equivalence reconciliation ("blob IDs identical") —
  byte-identity clears the *code*, not the *review-freshness gate*.
- The critique gate (codex OUTPUT_REVIEW / DECISION_REVIEW) repeatedly catches attempts
  to paper over staleness; the honest encoding is *unevaluable*, not a faked pass.

## Why Devin lags the head, and how it fails

Devin reviews the PR URL and re-analyzes per commit, but the anonymous agent-browser
scrape captures whatever the page currently shows — which trails a force-push or merge
by minutes. Three concrete lag signatures recur, and the discipline is the same across
all of them: never let Devin's own claim of coverage stand in for verification.

On a **rebased / re-pushed** PR, Devin's flags reference file:lines that no longer exist:
in slang#12517 Devin described the R1-era 43-line test with `-dump-ir` when the head had
a rewritten 67-line `-target spirv-asm` test, and `devin-commit-status.txt` read
`"unknown"` — the tell that the review did not cover the pinned commit
[Devin head-stale on rebased PRs — never stamp commit_id=head](../learnings/1788220739759-approver-infra-abstain-devin-review-can-be-head-st.md).
On a **freshly force-pushed** PR the panel can carry a *prior round's vintage* entirely:
slang#12863 saw a 🔴 at `:85` (a blank line; the real branch was at 114–123) describing
the very bug the PR fixes, with Devin's prose narrating the round-1 "one-line fix / two
tests" while the head had three tests and a new class — four independent tells of a
stale scrape
[Devin on a freshly force-pushed PR can return a STALE false-positive](../learnings/1788262022886-devin-review-on-a-freshly-force-pushed-pr-can-retu.md).
On a **rapid force-push burst** (slangpy#1129, three pushes in one session) Devin cached
the *superseded* middle commit's "+16 expanded doc" while the settled head was the terse
"+13" — but because the delta was doc-comment-only and the function body was blob-identical
(`c5ccc7bc..c35d71a4`), the "clean code" verdict transferred and no re-run was needed; the
right call was to record the lag, not burn STALE_STAGE
[Devin lags rapid force-pushes; cross-check shown diff vs your head read](../learnings/1788154569520-approver-infra-abstain-devin-lags-rapid-force-push.md).
That last atom also documents the correct rate-limit move: when the shared install token
hits 6000/6000, read `X-Ratelimit-Reset`, background-poll for the reset, then RE-RESOLVE
`headRefOid` (it can move twice during the wait) — waiting beats an infra-abstain, and
first-write-wins per `commit_sha` means deciding against a stale head wastes the ledger row.

## The merge-head and draft→ready traps

Two head-shapes make the "Devin reviewed the head" assumption especially unsafe. A
**merge commit** head ("Merge branch 'master' into fix/issue-N") means Devin's narrative
very likely bound to the *pre-merge* content commit: on slang#12795 the pinned head
`6c50a9ad` was a master-merge and Devin's story tracked `3f759dd4`, with commit-status
`"unknown"`. Recording `commit_id=head` from content byte-identity ("blob IDs identical,
CI green at head") would "synthesize an exact-commit match from content equivalence,"
which the skill's invariants forbid — content byte-identity is a *content* argument, not
the sanctioned head-current *review* check
[master-merge head + commit-status unknown ⇒ head-current unverifiable](../learnings/1787914554673-approver-infra-abstain-master-merge-head-devin-com.md).
A **draft-then-readied** PR is the mirror case: on slang#12793 the first Devin fetch
returned a *draft-era* analysis (freshness `"unknown"`, prose saying "held as draft until
#12570 lands / fails today by design"). The fix is to re-run Devin pinned to the settled
head, confirm the freshness widget flips `"unknown"` → "Analysis is up to date", read the
prose for draft-era tells, and cross-check head-currency against live GitHub independently
[Verify Devin head-currency on dependency-ordered draft→ready PRs](../learnings/1787906963169-approver-critique-mustfix-verify-devin-head-curren.md).
That atom also warns against the inverse error: a *historical baseline* cited by Devin
("22 lines at origin/master c1cffad25") is TRUE history when c1cffad25 is a pre-merge
commit — date the cited commit rather than forcing a spurious INDETERMINATE.

## Partial render on large PRs, and workspace-backed evidence

For large PRs the failure is a **partial capture**, not a lag: `devin-fetch.sh` snapshots
the Devin page before the embedded GitHub diff-viewer finishes rendering. On slang#12039
(+454 lines) Devin embedded the literal `Loading diffs…` banner, clustered all findings in
`:6–:88`, and called the `:84-88` sections "empty stubs" that a stale bot review and
CodeRabbit both described as populated — the not-yet-loaded lower diff read as empty, so
its line-referenced findings were artifacts
[Devin 'Loading diffs…' banner = incomplete capture, low-confidence](../learnings/1788777703213-approver-challenger-miss-devin-loading-diffs-banne.md).
A second run explicitly instructing the subagent to "wait" reproduced the same banner and
the same false "empty stubs" — proving the limitation is in the tooling, not the prompt;
the truncation also VARIES run-to-run (R1 saw `:6–88`, R2 reached `:249–271`), so the max
cited line must be re-checked every run
[Devin partial-render is a devin-fetch.sh limitation; prompt 'wait' doesn't fix it](../learnings/1788792549825-approver-infra-abstain-devin-partial-render-is-a-d.md).
Finally, freshness claims must be **workspace-backed**: the codex OUTPUT_REVIEW critic
reads only the files you hand it, so an MCP-fetched fact (human review state, CI, PR
metadata) that lives only in your context is "unsupported" — persist it to an evidence
file and cite the path. And on the Devin-only tier, assert not "head-current" but the
provable thing: the change Devin analyzed matches the pinned head's diff, plus Step-1
`commit_match` passing because the tier writes `commit_id = commit_sha`
[cite only workspace-backed evidence; don't claim Devin 'head-current'](../learnings/1788167903200-approver-critique-mustfix-cite-only-workspace-back.md).

**Source learnings (8):**
- [Verify Devin head-currency on dependency-ordered draft→ready PRs](../learnings/1787906963169-approver-critique-mustfix-verify-devin-head-curren.md) — draft-era Devin analysis stamped head-current; re-run pinned + read freshness widget + prose tells + live cross-check.
- [master-merge head + Devin commit-status unknown ⇒ head-current unverifiable](../learnings/1787914554673-approver-infra-abstain-master-merge-head-devin-com.md) — Devin bound to pre-merge commit; content byte-identity is not the head-current review check; ABSTAIN NO_REVIEW_SIGNAL.
- [Devin lags rapid force-pushes; cross-check shown diff vs your head read](../learnings/1788154569520-approver-infra-abstain-devin-lags-rapid-force-push.md) — Devin cached superseded push; immaterial doc-only delta must not burn STALE_STAGE; rate-limit wait + re-resolve head.
- [Devin review can be head-stale on rebased/re-pushed PRs](../learnings/1788220739759-approver-infra-abstain-devin-review-can-be-head-st.md) — flags reference rewritten lines; never stamp commit_id=head to fake commit_match; omit or mark stale.
- [Cite only workspace-backed evidence; don't claim Devin 'head-current'](../learnings/1788167903200-approver-critique-mustfix-cite-only-workspace-back.md) — OUTPUT_REVIEW sees only staged files; persist MCP facts; assert diff-match + commit_match, not freshness.
- [Devin 'Loading diffs…' banner = incomplete capture](../learnings/1788777703213-approver-challenger-miss-devin-loading-diffs-banne.md) — partial render on large PR clusters findings at top and calls populated sections "empty stubs"; low-confidence.
- [Devin partial-render is a devin-fetch.sh limitation](../learnings/1788792549825-approver-infra-abstain-devin-partial-render-is-a-d.md) — prompt-level "wait" ineffective; truncation varies per run; also exit-10 stale-clean bot vs head-current Devin divergence.
- [Devin on a freshly force-pushed PR can return a STALE false-positive](../learnings/1788262022886-devin-review-on-a-freshly-force-pushed-pr-can-retu.md) — four tells (commit-status unknown, prior-round prose, wrong line, describes original bug); verify against source at exact head.
