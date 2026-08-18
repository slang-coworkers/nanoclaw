---
title: Approver decision procedure — clauses, verdicts, ledger, and the gate mechanics
type: concept
group: review
tags: [approver, clause-gap, ci-gate, ledger, critique-gate, abstain, shadow-mode]
source_count: 24
---

## TL;DR

The slang/slangpy PR-approver is a **shadow-mode predictor**: it emits one auditable verdict
(`WOULD_APPROVE | ABSTAIN_POLICY | ABSTAIN_INFRA | BLOCK`) that never posts to GitHub and never
confers an approval — it is scored later against the human outcome. The pipeline is ordered
**clauses (Step 1, cheap metadata predicates) → harvest + Devin → synthesis → challenger (Step 3)
→ critique gate → record_decision**. Run the cheap clauses *first*, always: a `tier_eligible` or
`changedFiles > cap` FAIL is terminal and saves the two most expensive steps.

The recurring failure class is a **clause that reads the wrong surface, or collapses several
epistemic states onto one `pass` token**, and every one fails silently toward "clean":

- `ci_green_on_sha` reads the **legacy combined-status API**, which structurally cannot see GitHub
  Actions check-runs — a lone `license/cla` context reads `success` over a red build. Two states
  map to `pass` (`policy waives CI` vs `CI actually green`); a waiver is not a satisfied check.
- `author_trust` reads the **PR author's** association only — a MEMBER *reviewer* approval never
  satisfies it, so bot-authored PRs abstain identically reviewed or not.
- A review's `commit_id` is **re-pointed by GitHub** when the head moves — `commit_match` passes on
  a commit that postdates the review. Check `committer_date(commit_id) > submitted_at`.
- A **submodule gitlink** bump is one entry to path/size clauses — 608 real lines reviewed as 220.
- The `>= per_page` pagination guard is **blind when you jq-filter inside the page** — measure the
  raw page length, then filter.

Give every clause a real `unevaluable`/`not_applicable` branch: a clause that cannot express its own
doubt launders "not asked" into "verified." On an **ABSTAIN early-return the critique gate is
skipped**, so the pre-record review re-fetch has no backstop — make it unconditional. When a turn
crashes, verify the **work's** state (ledger, `decision.md`), not the turn's; the stale artifact
always points the rounded-up way.

## The pipeline and its ordering

The approver builds its own review input — harvests any bot review on the PR (github-actions[bot] =
production claude-code-action; coderabbitai[bot]) read-only, runs Devin itself — then decides.
Deterministic clauses run first, verdict parse second, adversarial challenger last; recording is
critique-gated.

**Run Step 1 before honoring any named investigative request.** A specific, well-reasoned probe
("check the regeneration path was respected") reads as the real work and the clause script reads as
boilerplate — but the cheap clause can settle the decision the expensive probe was asked for. On
slang#12345 one `changedFiles` call (177 vs cap 150) terminated the decision; honoring the named
probe first would have burned a `collect-reviews.sh` pass plus a Devin browser run on a PR already
routed to a human. Two follow-ups that are easy to skip: **carry the named request forward in the
derivation** as *unprobed, with the reason*, and **check where the request belongs** before accepting
its framing — a diff-reading predicate placed in Step 1 evaluates `unevaluable` and lands a spurious
`ABSTAIN_INFRA` on every PR; its seat is the Step-3 challenger. [[approver/clause-gap] Run Step 1 before honoring a named investigative request — the cheap clause can settle the decision the expensive probe was asked for](../learnings/1785860675069-approver-clause-gap-run-step-1-before-honoring-a-n.md)

## The clause defects — every one fails silent toward "clean"

The unifying diagnosis across the clause gaps: **a clause reads a surface where the fact does not
live, or maps more than one epistemic state onto `pass`.** Audit heuristic: grep a clause's source
for how many distinct states map to `pass` — more than one is a smell.

**`ci_green_on_sha` reads the wrong instrument, not a weak one.** `repos/{repo}/commits/{sha}/status`
is the legacy combined-status endpoint; Actions jobs are *check-runs* on a different endpoint it
structurally cannot see. On slangpy repos the only legacy-status poster is often the CLA bot, so the
clause effectively asserts "the CLA is signed," not "CI is green" — and returns green while builds
are queued or even failing. Fix: consult check-runs (or `gh pr checks` / statusCheckRollup); any
`queued`/`in_progress` ⇒ `unevaluable`; a zero-CI-check sha ⇒ `unevaluable`, never `pass`.
[[approver/clause-gap] ci_green_on_sha reads the legacy combined-status API and passes while Actions CI is still pending](../learnings/1785856317379-approver-clause-gap-ci-green-on-sha-reads-the-lega.md)
[[approver/clause-gap] ci_green_on_sha reads the legacy combined-status API, which structurally cannot see Actions check-runs — it is the wrong instrument, not a weak one](../learnings/1785940225225-approver-clause-gap-ci-green-on-sha-reads-the-lega.md)

**Two states map to `pass`.** With `require_ci_green: false` in the shadow policy, the clause passes
at the "policy does not require CI" branch and never reads any CI surface at all — a *different*
false-safe than the blind-API one, indistinguishable from outside and separable only by reading the
recorded derivation. The ledger is the discriminator between the two failure modes. Fix priority:
split the token into `pass | unevaluable | not_applicable` (a waiver is never `pass`) *first*, then
fix the surface — the instrument fix is unreachable while policy waives CI.
[[approver/clause-gap] The closest instance was mine, but the mechanism was NOT the blind API — my ledger shows ci_green_on_sha passed via "policy does not require CI green" (require_ci_green:false), so the surface was never read at all](../learnings/1785943474723-approver-clause-gap-the-closest-instance-was-mine-.md)

**Reading both CI surfaces is necessary but not sufficient — coverage is a third question.** After
reconciling combined-status and check-runs (17/17 green, all complete), ask whether any green leg
*exercises the changed path*. On slangpy#925 the 17 green legs came from `ci.yml`, which lists
`wheels.yml` in `paths-ignore`; `wheels.yml` is `workflow_dispatch:`-only. CI was green about other
files. Three questions in order: **surface** (does the endpoint observe what I gate on?) →
**completeness** (every relevant leg completed+success?) → **coverage** (does any green leg touch a
changed path?). Each passes the check for the other two.
[[approver/clause-gap] Reading both CI surfaces is necessary but not sufficient — ask whether any green leg exercises the changed path (measured: 17/17 green, zero coverage of the diff)](../learnings/1785941299379-approver-clause-gap-reading-both-ci-surfaces-is-ne.md)

**The just-past-empty (`n=1`) hazard is measured, not hypothetical, and it is the *modal* config.**
GitHub's combined-status returns `pending` for zero statuses (a deliberate special case), so one
trivial poster (`license/cla`) is the first config where the guard is satisfied and the substance
absent. On slang#12359 a lone CLA `success` stood over 81 check-runs with **2 failing**. Fleet
sweep: `n=1` occurs on ~40% of sampled PRs. Treat combined-status `success` with `n=1` (or an
all-bot context set) as `unevaluable`, and read check-run *conclusions*.
[[approver/clause-gap] The just-past-empty hazard is now MEASURED, not spec-derived — slang#12359: combined-status success from 1 CLA context while 2 of 81 check-runs are FAILING (n=1 is abundant fleet-wide, ~40% of sampled PRs)](../learnings/1785943156064-approver-clause-gap-the-just-past-empty-hazard-is-.md)

**`author_trust` reads the PR author's association only.** `author_association` on the pull object
describes the author, not any reviewer. A MEMBER reviewer approving the exact head does not flip it,
so a bot-authored PR (`CONTRIBUTOR`) abstains identically whether or not a maintainer reviewed —
flattening the very signal agreement-scoring needs, and a dominating FAIL masks every other clause's
defects for that whole PR class. Never infer a clause's input from a field name that appears in more
than one object. [[approver/clause-gap] author_trust reads the PR AUTHOR's association only — a MEMBER approval pinned to head cannot satisfy it, so bot-authored PRs abstain identically reviewed or not](../learnings/1785935735721-approver-clause-gap-author-trust-reads-the-pr-auth.md)

**A review's `commit_id` is platform-maintained state, not history.** When a PR advances, GitHub
re-points a still-valid APPROVED review at the new head, so `commit_id == head` is satisfied *by the
head moving*. Falsifier: `committer_date(commit_id) > submitted_at` is physically impossible for an
honest "reviewed at this commit" claim ⇒ the field was re-pointed ⇒ `unevaluable`. Generalizes to any
platform-maintained field (mergeability, check conclusions on a moved head): ask "could this field
have become correct without anyone doing the thing I'm verifying?"
[[approver/clause-gap] A review's commit_id is NOT evidence of the tree the human reviewed — GitHub re-points it, so commit_match passes on a commit that postdates the review](../learnings/1785939783049-approver-clause-gap-a-review-s-commit-id-is-not-ev.md)

**A submodule gitlink defeats every path- and size-based clause.** The gitlink is one entry in the
outer commit's changed files, so 608 real lines (7 commits, 22 files) get scored as "220 lines / 7
files," and inner paths are invisible to `no_protected_paths`. Blind by construction, not
configuration — re-tightening `protected_paths` cannot fix it. (Correction thread: the path-blindness
half is repo-specific — here `external/**` incidentally catches the outer gitlink entry; the
size/attention undercount is fully general. Anchor the matcher domain: a compare API on a *submodule*
returns submodule-root-relative paths, a compare on the *consumer* returns consumer-tree paths;
mixing them tests a repo that does not exist. Print the per-path matcher set, never describe it, and
know the two globs fail opposite ways — `.github/**` is root-anchored and under-reaches;
`**/*.yml` is unanchored and over-reaches.)
[[approver/clause-gap] D3 confirmed — a submodule gitlink defeats every path-based and size-based clause; 9 protected-path hits invisible on slangpy#1090, but they execute in the SUBMODULE's CI, not the consumer's](../learnings/1785938476891-approver-clause-gap-d3-confirmed-a-submodule-gitli.md)
[[approver/clause-gap] CORRECTION to D3: my "9 protected-path hits" used submodule-root-relative paths — correctly anchored it is 22/22, and the path-blindness half of D3 is repo-specific, not general](../learnings/1785938685109-approver-clause-gap-correction-to-d3-my-9-protecte.md)
[[approver/clause-gap] CORRECTION: the 13 paths external/** uniquely protects contain zero .yml — they are the C++ implementation; and the two globs fail in opposite directions (.github/** under-reaches, **/*.yml over-reaches)](../learnings/1785939070353-approver-clause-gap-correction-the-13-paths-extern.md)

**The `>= per_page` pagination guard is blind when you jq-filter inside the page.** A filtered count
is *supposed* to be smaller than `per_page`, so "short page" and "filtered page" produce identical
evidence and the guard silently does not apply — combined with `--paginate` dying mid-walk (partial
array, no error exit), a confident wrong total with no tell. Measure the **raw** page length for the
pagination decision, then filter for the answer; two numbers per page, never one. General rule: a
guard computed on a transformed view of the data does not guard the data. (Worked case in
[[wiki/concepts/review-a-challenger-calibration.md]].)

**A stale bot review's 🔴 is a hypothesis to re-test at the pinned head, not a BLOCK you inherit.**
A stale CodeRabbit Critical about `slang-2026.5.2-...aarch64` was moot because the pin had advanced
to 2026.12, which ships that asset. Re-derive any pinned version/tag/URL/asset at the pinned head
before believing the finding, and check the reviewer's path filters — "a bot reviewed this PR" is not
"a bot reviewed this file." [[approver/clause-gap] A stale bot review can carry a red Critical that is MOOT on the pinned head — check the version it reasoned about](../learnings/1785935459444-approver-clause-gap-a-stale-bot-review-can-carry-a.md)

## Merge-state, review-state, and automation reads

**An approval is a review STATE, not a comment.** An empty-bodied APPROVED review is invisible to
`issues/N/comments` and `pulls/N/comments`. Approval state comes from `pulls/N/reviews` or GraphQL
`reviewDecision`; `body_len: 0` is normal. The four GitHub PR channels answer different questions —
`pulls/N/reviews` (state + bodies), `pulls/N/comments` (inline threads), `issues/N/comments`
(maintainer directives), GraphQL `reviewDecision` (aggregate). A directional statement of a symmetric
endpoint-split rule teaches only the direction you were burned in — state every direction. And a
fresh measurement contradicting yours means audit your instrument before disputing: a per-artifact
tier reading the artifact should be the prior over an aggregator reading a summary.
[An approval is a review STATE, not a comment — and a directional statement of a symmetric rule teaches only the direction you were burned in](../learnings/1785849723052-an-approval-is-a-review-state-not-a-comment-and-a-.md)

**COMMENTED ≠ CHANGES_REQUESTED.** A maintainer who wanted to block had CHANGES_REQUESTED available
and chose COMMENTED — a deliberate non-blocking state. Pushing fixes to satisfy comments would
dismiss a *different* maintainer's live approval (approvals pin to a SHA). The correct move is
reply-only: concede, state the conflict, and ask. Check the formal review state, whether a live
approval exists and its SHA, and whether the two reviewers are the same person.
[COMMENTED ≠ CHANGES_REQUESTED: maintainer comments on an approved PR do not authorize dismissing another maintainer's approval](../learnings/1785866765386-commented-changes-requested-maintainer-comments-on.md)

**Read `autoMergeRequest` + `reviewDecision` before naming a human as the blocker.** "Awaiting
review" and "armed to self-merge" look identical on the reviews endpoint. A requested reviewer
persists after approval; `autoMergeRequest` is a separate field the reviews endpoint does not expose.
An armed auto-merge on a PR with an open `OPEN_GAP` is materially more urgent — the human window is
bounded by the next base push, not a review queue. Enumerate the automation (merge queues,
auto-merge, scheduled rebases, write-access bots) that can act instead of a human.
[[approver/clause-gap] Read autoMergeRequest + reviewDecision before naming a human as the blocker — "awaiting review" and "armed to self-merge" look identical on the reviews endpoint](../learnings/1785939843206-approver-clause-gap-read-automergerequest-reviewde.md)

**A rebase dismisses approvals, and BLOCKED can change meaning without changing string.** A
force-push invalidates existing approvals — price "this costs a human re-review" into the decision to
rebase, not after the push. `mergeStateStatus: BLOCKED` is a summary over several conditions
(`isDraft`, `reviewDecision`, `statusCheckRollup`, `mergeable`); the token is stable while its causes
rotate. Decompose composite tokens every read; never report "CI green" as a readiness claim — CI is
one of ≥3 gates. [A rebase dismisses approvals, and BLOCKED can change meaning without changing string](../learnings/1785940451757-a-rebase-dismisses-approvals-and-blocked-can-chang.md)

## The ABSTAIN early-return has no critique backstop

On an ABSTAIN the OUTPUT_REVIEW / DECISION_REVIEW critique gate is deliberately skipped (abstains
assert nothing about the code), and a Step-1 clause FAIL short-circuits before verdict/challenger.
So ABSTAIN paths are the *most* exposed to review-staleness, not the least — inverted from where the
safety net sits. Make the pre-record review re-fetch **unconditional**, especially on the abstain
path: `gh pr view <pr> --json reviews` (not `gh api .../pulls`, which the critique-gate Bash hook
false-matches), retag `mode` if it flipped, call `record_human_verdict` for any APPROVED on the
pinned head, and make `next-action` state what the human state actually IS. The decision derivation
stays independent — a racing human review flips the ledger tag, not your verdict.
[[approver/clause-gap] on an ABSTAIN early return the critique gate is skipped — so the pre-record review re-fetch has NO backstop (3rd recurrence, slangpy#1084 rev-4)](../learnings/1785856442168-approver-clause-gap-on-an-abstain-early-return-the.md)

## Recording: materialize the payload, and survive a crash

**OUTPUT_REVIEW cannot verify a ledger row you describe in prose.** "clauses.json verbatim" is a
promise about bytes the reviewer cannot see, and the whole point of the gate is that the *recorded*
row was reviewed. Materialize the exact payload as a file before the gate, attest that the values
passed to `record_decision` are byte-identical (naming the one exception, `ts`, stamped at call
time), and `sha256sum` to confirm. Building the payload as data before the gate means the reviewed
artifact *is* the recorded artifact — and it catches, for free, a withdrawn hypothesis living under a
`withdrawn_hypothesis` key rather than as a live claim. Gate mechanic: `codex-reply` does not carry
`developer-instructions`, so a stage re-review sent as a reply is not recorded — each stage needs a
fresh `mcp__codex__codex` call, and OUTPUT_REVIEW must end on `approve`.
[[approver/critique-mustfix] OUTPUT_REVIEW can't verify a ledger row you describe in prose — materialize the exact payload](../learnings/1785935912181-approver-critique-mustfix-output-review-can-t-veri.md)

**A turn-level error is evidence about the transport, never about the work.** A 429 arrives on the
same channel whether the turn did nothing or everything, so "the turn errored" carries no information
about progress — and treating it as "the work didn't happen" duplicates the work. Worse, a crash
between the ledger append and the memory write leaves the stale artifact asserting the **rounded-up**
verdict, *structurally*: a critique reversal is by construction the later write, so any crash inside
the write window leaves the pre-reversal (more permissive) claim standing. Before re-deciding on a
resumed turn, verify the work's state — `gh pr view --json state,headRefOid,mergedAt` (head moved ⇒
real new revision; same ⇒ suspect stale replay) and grep the prior transcript for the
`record_decision` call. Ledger + `decision.md` outrank your own memory store.
[[approver/infra-abstain] A turn-level error (429) is evidence about the TURN, never about the WORK — and a crash between ledger-append and memory-write leaves the stale artifact asserting the ROUNDED-UP verdict](../learnings/1785939194456-approver-infra-abstain-a-turn-level-error-429-is-e.md)

**"Did my tool call land?" has three tiers — measure which one you hold.** (1) *emission* —
`ncl sessions messages <sess> --include-system` renders `[system: record_decision]` with the payload
*absent*; (2) *host acceptance* — the raw `.jsonl` `tool_result` paired by `tool_use_id`, which names
repo/PR/sha/decision and is host-authored by construction (assistant messages carry `tool_use`; every
`tool_result` arrives `role=user`, harness-injected — provenance is structural, not a matter of
trusting the agent); (3) *the committed row* — reading `approval_decisions`, impossible in-container.
`--include-system` does **not** rise to tier 2: isolate `--kind system` and it carries the verb name
only, no payload; an unfiltered grep finds the sha only in the agent's own chat prose. A claim that a
probe shows MORE than you measured (untested REACH) has no natural error signal — grep for the
specific token you claim it surfaces.
[[approver/infra-abstain] Three tiers of "did my tool call land?" — and why an untested REACH claim escapes the check that catches an untested LIMIT](../learnings/1785940603119-approver-infra-abstain-three-tiers-of-did-my-tool-.md)
[[approver/infra-abstain] CORRECTION to 1785787116199: `--include-system` does NOT prove "byte-level content" — isolate `--kind system` before crediting a view with payload](../learnings/1785941116808-approver-infra-abstain-correction-to-1785787116199.md)

## The escalation channel and its limits

`ask_user_question` is the escalation path (`timeout: 0` for no-acceptable-fallback human decisions).
Three successive misdiagnoses of one rejection symptom — "channel broken," then "`timeout: 0` is the
trigger," then "question length between ~330 and ~1,100 chars" — were all wrong: the actual cause is
**payload size, roughly** (~58 chars accepted, ~200 rejected, plausibly a combined `question`+`options`
budget), and the error text (`title, question, and options are required`) names the fields you *did*
supply, sending you down wrong paths. **Bisect the payload before diagnosing the tool**: strip to the
minimum accepted shape, confirm, add back one variable at a time — one comparison is a guess with a
control, not an isolation. Keep the question to one short sentence and put detail in a separate
`send_message`; and stop bisecting once the probe costs a human something (each test fired a card at
an absent operator). [[approver/infra-abstain] ask_user_question is NOT broken — `timeout: 0` triggers a spurious "title, question, and options are required" rejection, and that is the value the escalation guidance mandates](../learnings/1785939919532-approver-infra-abstain-ask-user-question-is-not-br.md)
[[approver/infra-abstain] CORRECTION twice over: ask_user_question rejects on question LENGTH, not timeout:0 — and the error message names the three fields you did supply](../learnings/1785940925266-approver-infra-abstain-correction-twice-over-ask-u.md)
[[approver/infra-abstain] ask_user_question length limit is far tighter than I first bisected — ~58 chars accepted, ~200 rejected; my published 330-1100 range was wrong](../learnings/1785941262408-approver-infra-abstain-ask-user-question-length-li.md)
