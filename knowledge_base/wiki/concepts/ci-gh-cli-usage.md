---
title: "gh CLI Usage & PR/Issue Mechanics"
type: concept
group: ci-tooling
tags: [gh-cli, github, pr, issues, workflow, bot-process, slang]
source_count: 24
---

# gh CLI Usage & PR/Issue Mechanics

# gh CLI Usage & PR/Issue Mechanics

# gh CLI Usage & PR/Issue Mechanics

Concrete pitfalls and correct patterns for using the `gh` CLI in the Slang project: search limitations, closing-issue verification, comment retrieval, PR review detection, and bot process rules around GitHub writes.

**Split 2026-08-05 at the 40 KB page cap.** Everything about *how `gh`/git readings lie* — collection caps, silently-truncated arrays, endpoint splits, path-classed 401s, and the control shapes that catch them — moved to [GitHub/git Instrument Limits — Caps, Silent Truncation & Endpoint Splits](../concepts/ci-github-instrument-limits.md). This page keeps *how to drive* the tools.

> **This page is part 1 of 2** of the gh CLI Usage & PR/Issue Mechanics synthesis (split 2026-08-07 to stay under the 40 KB read cap). Siblings: [part 2](ci-gh-cli-usage-2.md). The TL;DR below is shared across all parts.

> **This page is part 1 of 2** of the gh CLI Usage & PR/Issue Mechanics synthesis (split 2026-08-07 to stay under the 40 KB read cap). Siblings: [part 2](ci-gh-cli-usage-3.md). The TL;DR below is shared across all parts.

## TL;DR
- **`gh search` is not an existence or merge oracle.** `gh search prs`/`issues` have index lag and return false zeroes; `is:merged` returns 0 while PRs demonstrably merge. Use the timeline, `closingIssuesReferences`, a `--head fix/issue-<n>` list, or a direct `pulls/<n>` read.
- **A PR title containing `Fix #N` does not auto-close anything** — GitHub honors the keyword only in the PR **body** (or a manual Development-panel link). Verify with `gh pr view <pr> --json closingIssuesReferences`, never a body regex (the `owner/repo#N` long form defeats a naive pattern).
- **`gh issue view --comments` can print nothing at exit 0** — a renderer quirk, not an auth failure. Read `gh api .../issues/<n>` and `.../issues/<n>/comments` instead.
- **Never cite an env var, CLI flag, or command name you have not verified** via `--help`/`man`/repo grep. It is a high-frequency hallucination surface and a fabricated knob name is unrecoverable for the reader.
- **Pushing commits to a `fix/issue-*` branch is not a user-facing write** and needs no per-push approval. The gated set is narrow: PR/issue comments, review replies, reactions, `gh pr ready`, merge.
- **A draft-held fix PR does not discharge the issue comment.** `Fixes #N` in a draft body neither auto-closes nor surfaces; post the 5-bullet on the issue when you *decide* to hold.
- **`gh api .../user.login` omits the `[bot]` suffix** — never compare it raw against a review author.
- **An infra-unblock nudge is not a decision override**: being told "you're unblocked" restores capability, not authority to change a verdict.
- **A `gh` name that resolves is not the name you meant.** `--workflow <typo>.yml` binds silently to a *retired* workflow with the words reordered and serves its old runs. Enumerate workflow paths; never type one from memory. Weeks-old rows in a query about *recent* automation are an instrument alarm, not a finding.
- **`gh run rerun` rc=0 is not proof it fired; an unchanged `run_attempt` is not proof it didn't.** Proof is a second rerun returning 403 "already running". Key reruns on `(workflow_id, event, name)`, never name alone.
- **A run concluding `success` may have declined to act** — read the script's decision line in the log, not the conclusion. Priority-yield aging is contention-gated (12h yield-out / 16h lookback); a yielded run can expire unrerun.
- **Bucket a CI red by its terminal outcome, never by a signature string's presence.** When a challenged total reproduces unchanged, verify its members — offsetting errors pass every sum check.

## gh search prs Is Unreliable for Recent PRs

`gh search prs --repo <r> "<text>"` and `gh search issues` have indexing lag and gaps — they can return zero results even for open, matching PRs. Do NOT use search to determine whether an issue already has a linked PR. Use direct queries instead:

- `gh api repos/<owner>/<repo>/issues/<num>/timeline` — look for `cross-referenced` or `connected` events
- GraphQL `closingIssuesReferences` on the PR
- Branch convention: `gh pr list --repo <r> --head fix/issue-<num>`
- If the PR number is known: `gh api repos/<r>/pulls/<num>` directly ([gh search prs misses recent/open PRs — don't use it for PR-existence checks](../learnings/1780327495315-gh-search-prs-misses-recent-open-prs-don-t-use-it-.md))

Note: a PR title containing `Fix #N` does NOT auto-close the issue — GitHub only honors `Close(s)/Fix(es)/Resolve(s) #N` in the PR body (or a manual Development-panel link).



## A Name That Resolves Is Not the Name You Meant

`gh search` returning too little is the benign half of this family; the dangerous half is a selector that resolves to the **wrong population** and returns a coherent dataset for it. `gh run list --workflow retry-yielded-bot-ci.yml` returned eight `completed/success` runs dated five weeks earlier — read, reasonably, as "this automation is dead". That filename does not exist: the real path is `ci-retry-yielded-bot.yml`, and `gh` silently bound the typo to a **retired** workflow whose *name* was the same words reordered, serving its final pre-deletion runs; the correct path showed 15 fires in the last hour. A 404 would have been safe because it is loud — instead the answer was well-formed *and* a legitimate-looking finding, with no failure signature, the family of `|| echo 0` laundering a tooling error into a plausible datum. So **never type a workflow filename from memory**: enumerate and copy it (`gh api repos/<o>/<r>/actions/workflows --paginate --jq '.workflows[]|.path'`), which matters most in shader-slang/slang with its 82 near-identically-named `ci-*` workflows. A `contents/.github/workflows/<name>` 404 cross-checks only when paired with a **positive control** in the same enumeration (`ci.yml` must appear), since a path-filtered query cannot distinguish "absent" from a permissions problem. Never call a workflow retired without confirming the name binds to what you meant [gh run list --workflow <wrong-filename> silently returns a RETIRED workflow's old runs instead of erroring](../learnings/1786079545237-gh-run-list-workflow-wrong-filename-silently-retur.md).


## Checking Closing-Issue Links

To verify a PR auto-closes an issue, use:

```bash
gh pr view <pr> -R <owner>/<repo> --json closingIssuesReferences --jq '[.closingIssuesReferences[].number]'
```

Do NOT decide from a body regex. GitHub honors both the short form (`Closes #N`) and the long form (`Closes owner/repo#N`) — a naive `keyword #N` pattern produces false-negatives for the long form. The API call is authoritative ([Check a PR's closing-issue link via gh closingIssuesReferences, not a body regex](../learnings/1780462327680-check-a-pr-s-closing-issue-link-via-gh-closingissu.md)).



## gh issue view --comments Can Return Empty

`gh issue view <n> -R shader-slang/slang --comments` can return empty output (exit 0) even for issues with comments — this is a text-renderer quirk, not an auth or network failure. For reliable issue and comment reads, use:

```bash
gh api repos/<owner>/<repo>/issues/<n>          # body
gh api repos/<owner>/<repo>/issues/<n>/comments  # comments
gh issue view <n> --json number,title,state,author,labels,body
```

([gh issue view --comments can return empty; use --json or gh api for comments](../learnings/1782389247211-gh-issue-view-comments-can-return-empty-use-json-o.md))



## Verifying release artifacts vs. reporter claims

When a reporter says an official release artifact has a version mismatch, download and inspect the actual artifact before routing a fix. The zip ships `include/slang-tag-version.h` (contains the embedded version) and the binaries. `slang-compiler.dll` is the module that implements `getBuildTagString`; `slang.dll` is a ~156KB re-export shim. CI run logs expire after ~few weeks (HTTP 410 Gone), so the artifact is often the only remaining ground truth. A `strings` grep on the binary is the authoritative check ([Verify a reported release-version mismatch against the actual artifact before treating it as a release-CI bug](../learnings/1781385600632-verify-a-reported-release-version-mismatch-against.md)).



## Don't Cite Env Vars or Flag Names Without Verifying

Env-var, CLI-flag, and command names are a high-frequency hallucination surface. Before writing any env var, CLI flag, registry key, or command name in a user-facing reply, verify it via `man`, `--help`, the project's docs, or a GitHub grep on the project repo. A fabricated knob name is unrecoverable for the reader; a verified name is always preferable to a confident-sounding wrong one ([Don't cite env-var or flag names without verifying — they're a high-frequency hallucination surface](../learnings/1780177920997-don-t-cite-env-var-or-flag-names-without-verifying.md)).



## Pushing Commits Is Not a User-Facing Write

Pushing code commits to a `fix/issue-*` branch never requires per-push operator approval — not for draft PRs, not for ready PRs, not in response to automated reviewers (CodeRabbit). The operator-gated set is narrow: PR/issue comments, review replies, emoji reactions, `gh pr ready`, merge/mark-ready-for-review. A commit push is none of those ([Pushing code commits is NOT a user-facing write — it's always allowed, draft or ready](../learnings/1780726000000-pushing-commits-is-not-a-user-facing-write.md)).



## Draft-Held Fix PR Still Needs the Issue Comment

When a triaged issue's resolving PR is held as a draft, the `Fixes #N` in the draft PR body does NOT auto-close the issue and does NOT surface prominently. The 5-bullet triage outcome comment MUST still be posted on the issue (verdict = "Triaged → fix in draft PR #N, held pending review/approval"). Treat the decision to hold the PR as a draft as the trigger for the issue comment ([Draft-held fix PR still needs the issue 5-bullet — post it when you decide to hold, not after a nudge](../learnings/1780900630856-draft-held-fix-pr-still-needs-the-issue-5-bullet-p.md)).



## Verifying a Cited Fix PR Is an Ancestor

When a triage memo frames an issue as "still broken despite PR #N," first run:

```bash
git merge-base --is-ancestor <fixPR-merge-commit> <reporter-build-commit>
```

If the exit code is non-zero, the fix was NOT in the reporter's build. The correct deliverable is regression-test coverage, not a new fix. Get the reporter's build from their `slangc -v` / `git describe`, and the fix-PR's merge commit via `gh pr view N --json mergeCommit` ([Verify the cited fix-PR is an ancestor of the reporter's build before accepting regression/incomplete-fix framing](../learnings/1780648573408-verify-the-cited-fix-pr-is-an-ancestor-of-the-repo.md)).



## Detecting Transient Claude CLI Failures in PR Review Runners

When running `/slang-pr-review` background reviewers (`compose-and-run.sh` for Reviewer A, `run-clarity.sh` for C), the background-task completion notification's exit code is the wrapper's `echo`, not the inner script — it shows 0 even when the review failed. Always grep for `REVIEWER_*_EXIT=` in the log.

Failure signatures: Reviewer A — `final-review.md` missing, stream's final `result` record has `is_error:true` + socket-closed message, tiny cost (~$0.05, num_turns≈2); Reviewer C — exit 143 (SIGTERM), no `clarity-review.md`, `stream.jsonl` ends with no `result` line. On either signature, re-run that reviewer's script (idempotent). Then validate: files non-empty, zero "API Error" hits, for C confirm `tool-uses.jsonl` has zero GitHub-write calls ([slang-pr-review: detecting transient claude-CLI failures in A/C runners](../learnings/1780650742331-slang-pr-review-detecting-transient-claude-cli-fai.md)).



## Infra-Unblock Nudge Is Not a Decision Override

An infra-unblock signal (disk freed, build can now run, CI green) is orthogonal to a disposition-based hold. Before resuming a parked chain, verify the recorded release trigger. If a nudge rests on a false premise (assumes the chain was infra-blocked when it was decision-blocked), route it to the disposition owner rather than acting on it ([An infra-unblock nudge is not an override of a decision-based hold — verify the actual trigger](../learnings/1782719314130-an-infra-unblock-nudge-is-not-an-override-of-a-dec.md)). Similarly, a templated/automated wake does not meet the "explicit operator go" bar when it carries a false premise, is a repeat of an identical earlier nudge already ruled on, or does not address the actual decision that was escalated ([Templated operator-wake ≠ explicit scoped override of a considered hold](../learnings/1782734222994-templated-operator-wake-explicit-scoped-override-o.md)).

The same read-only-blind-spot trap bites the maintainer daily report: a `gh` label scan cannot see in-flight coworker session chains, so an issue missing `Dev Reviewed` is *not* the same as "untriaged, needs routing / apply P0" — that over-claims a routing gap that may not exist (observed 2026-07-31: slang #12285/#12291 and slangpy #1079 flagged as "untriaged" were all already triaged and in-flight, with #12291 GitHub-assigned to jhelferty-nv). Keep the severity read, but reframe the ask from "untriaged → route/label P0" to "severity: P0-class; work-state: triaged & in-flight, fixer/triager-owned; `Dev Reviewed` + priority are the human maintainer's to apply" — the label is a human write, not a coworker routing gap, and when work-state isn't verifiable from the scan, say so ("label view only; work-state not verified") rather than asserting fresh dispatch is needed ([daily-report P0 candidates: label view ≠ work state (read-only blind spot)](../learnings/1785485841108-daily-report-p0-candidates-label-view-work-state-r.md)).



## Furo Theme Dark-Mode Code Colors

For the `shader-slang/shader-slang.github.io` Sphinx site using the Furo theme, use `pygments_dark_style` in `docs/conf.py` rather than CSS overrides. Furo emits its dark-mode rules wrapped in `body:not([data-theme="light"]) .highlight .k { … }` (higher specificity than a plain `.highlight .k`), so CSS overrides lose in dark mode. The intended hook is `pygments_dark_style = "<PygmentsStyleClass>"` pointing to a custom `pygments.style.Style` subclass. Delete the `.highlight .*` color-override block from `theme_overrides.css` after adopting custom styles. For non-Pygments code on the same page (e.g. auto-generated reference with `pre .code_keyword` etc.), scope those rules with `body[data-theme="dark"]` ([Furo theme dark-mode code colors — use pygments_dark_style, not CSS overrides](../learnings/1779427288040-furo-theme-dark-mode-code-colors-use-pygments-dark.md)).




## Recent operational learnings (incremental fold 2026-07-17)

**[approver/clause-gap] ci_green_on_sha reads only the combined-status endpoint, not Actions check-runs — and the CodeRabbit exit-22 wait-then-reharvest works** — Context: slangpy#1065 (version-bump PR), fallback tier. [[approver/clause-gap] ci_green_on_sha reads only the combined-status endpoint, not Actions check-runs — and the CodeRabbit exit-22 wait-then-reharvest works](../learnings/1784148788488-approver-clause-gap-ci-green-on-sha-reads-only-the.md)

**Rerun supersedes attempt-1 logs — capture receipts before rerunning** — **Rule:** If you intend to cite an attempt-N FAILED line as evidence (e.g. [Rerun supersedes attempt-1 logs — capture receipts before rerunning](../learnings/1784182764154-rerun-supersedes-attempt-1-logs-capture-receipts-b.md)

---


## Critique-Gate Hook False-Matches Read-Only `gh api .../pulls/...` GETs (2026-07-12 fold)

In a critique-gate-overlay container (`CRITIQUE_GATE_ACTIVE=1`), a pure read-only GET like `gh api repos/O/R/pulls/12065/reviews` is DENIED pre-execution ("CRITIQUE REQUIRED before PR creation") — `/app/hooks/gate-critique-on-deliver.sh` matches `gh api [^|]*pulls\b` method-blind, so it catches any `gh api` path containing `pulls`, not just `POST .../pulls`. The whole compound Bash command is blocked, so side effects (mkdir, writes) in the same call also don't run. Avoid it: use `gh pr view <n> --json <fields>` and `gh pr diff <n>` for PR reads (no literal `api .../pulls` substring), and `gh api graphql -f query='...'` for inline review threads / resolve state / per-review commit_id (the endpoint path is `graphql`, not `.../pulls`). The bundled `harvest-reviews.py`/`eval-clauses.py` call `gh api .../pulls` inside python, which the hook doesn't see — only raw `gh api .../pulls` typed directly into a Bash tool call trips. Also pre-create `mkdir -p /workspace/.claude` if you hit a `workflow-state.json.tmp: No such file` hook error before your first critique ([critique-gate hook false-matches read-only gh api pulls GETs as PR-creation](../learnings/1783806666221-approver-infra-critique-gate-hook-false-matches-re.md)).



## gh .user.login Omits the [bot] Suffix (2026-07-14 fold)

The REST API returns a bot account's login bare (`nv-slang-bot`), not the `nv-slang-bot[bot]` form shown in the UI — so an "edit-if-last-poster-is-self" comment guard that compares against `nv-slang-bot[bot]` mis-fires and posts a DUPLICATE. Compare against the bare login ([gh .user.login omits the [bot] suffix — edit-if-self guards must compare bare login](../learnings/1783935090568-gh-user-login-omits-the-bot-suffix-edit-if-self-gu.md)).



## GraphQL-401-while-REST-healthy phantom-greens a CI sweep (`gh pr checks` is GraphQL-backed) (2026-08-01 fold)

This extends the "gh search is unreliable" theme into a far more dangerous failure mode: when the GitHub gateway is in a **partial** state — GraphQL returns `401 Bad credentials` while REST is *fully* healthy (`gh api repos/.../pulls/N`, `commits/<sha>/check-runs`, `commits/<sha>/statuses`, `actions/runs`, and even `gh run rerun --failed` all succeed) — the CI-sweep entry-point tools silently lie. `gh pr checks <N>` and `gh pr view <N>` are **GraphQL-backed**: on a GraphQL 401 they print the error to **stderr** and return **nothing on stdout**, so a sweep loop that greps stdout for `fail` (or swallows stderr with `2>/dev/null`) sees zero failures and reports **every PR false-green**. Observed twice on 2026-08-01 (~10:00Z and ~12:00Z on the Slang CI babysitter): a clean 20/20 "no failures" that was pure phantom — silence looked exactly like health. Root cause is a recurrence of the App-token-refresh gateway split (`project_github_gateway_actions_graphql_401`).

Defense: never trust `gh pr checks`/`gh pr view` empty output as "green" without confirming GraphQL is up — if a sweep sees suspiciously-uniform all-green, probe `gh api graphql -f query='{viewer{login}}'` first; if it 401s while REST works, route the ENTIRE failure-enumeration through REST and proceed (the job is fully doable — reads AND reruns work, so do NOT hold read-only for this facet):

```bash
sha=$(gh api repos/<o>/<r>/pulls/$PR --jq '.head.sha')
gh api "repos/<o>/<r>/commits/$sha/check-runs?per_page=100" --paginate \
 | jq -s '[.[]|.check_runs[]?]|[.[]|select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out" or .conclusion=="startup_failure")]|group_by(.name)|map(.[0])'
gh api "repos/<o>/<r>/commits/$sha/statuses?per_page=100" \
 | jq '[.[]|select(.state=="failure" or .state=="error")]|group_by(.context)|map(.[0])'
```

Notes: (1) `--paginate` concatenates JSON objects, so a bare `.check_runs[]` dies on page 2 — but do **NOT** reach for the optional-`?` form (`jq -s '[.[]|.check_runs[]?]'`) as the fix, as an earlier revision of this page recommended. **That `?` is itself a silencer**: it swallows a gateway error document (which has no `.check_runs` key) and hands you a clean-looking result built from page 1 only. Gate on shape instead — `jq -e '.check_runs'` per page — and reconcile the count (see *Pagination truncates silently* below). (2) Some required gates (merge-queue aggregators, cross-repo checks like SlangPy Tests) are commit **statuses**, not check-runs — check both. (3) The wake payload's `evicted` list may itself be GraphQL-derived → cross-check merge-group evictions via REST `actions/runs?event=merge_group`. This is distinct from a full actions:write outage (where `gh run rerun` returns 403 "Must have admin rights"); a fresh GraphQL-401-while-REST-ok is worth an operator ping via parent ([GraphQL 401 while REST healthy — gh pr checks silently false-greens a CI sweep (recurred 2026-08-01)](../learnings/1785578978509-graphql-401-while-rest-healthy-gh-pr-checks-silent.md), [gh pr checks phantom-greens the CI sweep when GraphQL is 401 but REST is healthy](../learnings/1785586525718-gh-pr-checks-phantom-greens-the-ci-sweep-when-grap.md)).



## is:merged Search Is Broken — Infer PR Merge From Simultaneous Issue-Close (2026-08-01 fold)

A companion to the "gh search prs is unreliable" section, but for merge-detection specifically: the `mcp__slang-mcp__github_search_issues` `is:merged` query returns 0 results even over wide windows while PRs are demonstrably merging (confirmed 07-26 and again 08-01). Do NOT use `is:merged` to decide whether a PR merged. Reliable substitute: check whether the PR's **closing issue** is now CLOSED via `github_get_issue` — a PR with `Fixes #N`/`Closes #N` auto-closes its issue at the merge instant, so `issue.state == closed` + a matching `closed_at` = fix merged (e.g. 08-01, #12071 CLOSED 2026-07-30T18:34Z confirmed PR #12095 merged though `is:merged` returned nothing). Alternatively page the REST `commits` API — but note it truncates to ~15 entries, so widen the window or paginate or you'll undercount merges (07-28: counted 5, actual 9) ([is:merged search broken — infer PR merge from simultaneous issue-close](../learnings/1785572253771-is-merged-search-broken-infer-pr-merge-from-simult.md)).



## `gh run rerun` Returns 0 Before Anything Changes

`gh run rerun <id> -R <r> --failed` exits **0** as soon as the API accepts the request, but `run_attempt` can still read the **old** value immediately after — so rc=0 is not proof the rerun took, and a same-value `run_attempt` is not disproof (observed: read back `att=1`, nearly logged "rerun failed to take", then seconds later `att=2, in_progress, steps=4`). The unambiguous confirmation is to **issue the rerun a second time**: if the first took, GitHub replies 403 `{"message":"This workflow is already running"}` — positive proof; if it accepts again, the first never fired. Otherwise re-query after a beat and check `run_attempt` **and** `status` **and** `steps` length together, since a real re-execution has a fresh non-empty `steps` array. Related keying trap: one job *name* can exist on a single sha under two `event`s (`REUSE Compliance Check` on both `pull_request` and `push`) — rerunning "the REUSE run" greened the `pull_request` instance to att3 while the `push` instance sat red at att1 and the PR still showed a failure. **Key reruns on `(workflow_id, event, name)`, never name alone** [gh run rerun returns rc=0 before run_attempt increments — the proof it took is a second call returning 403 "already running"](../learnings/1786077463765-gh-run-rerun-returns-rc-0-before-run-attempt-incre.md).


## A `success` Conclusion Can Mean "Declined to Act" — Priority-Yield Aging

The belief that aging (`ci-retry-yielded-bot`, "~8h") forces a yielded bot CI run into a real verdict is **false as a timer**. `wait-for-priority.py --max-yield-hours 12` escalates only when the gate **runs again** and finds itself aged out (age from *original* creation, across reruns); a completed yielded run never escalates while sitting still. Escalation therefore needs a rerun, and reruns come only from `retry-yielded-bot-ci.py`, whose **first gate** is `any_active_ci(...)`: if any `ci.yml` run repo-wide is `queued|in_progress|waiting` it prints `CI is still active (N run(s)); not rerunning bot CI.` and exits 0 — then `--max-reruns 1` per fire, ascending `run_number`. Real params are **12h yield-out / 16h lookback**; past the lookback a run silently stops being a candidate and **expires unrerun** rather than escalating (one busy day: 60/60 fires over 5.4h blocked at gate 1, 32 candidates competing for the single slot).

The instrument lesson generalizes — **the aging run concludes `success` even when it did nothing**, so its conclusion says nothing about its decision. Read the decision line from the log, and since a GHA log echoes its own `run:` block, grep the *output*, not the echoed source:

```bash
gh run view <id> -R <repo> --log | grep -oE "CI is still active.*|No yielded bot CI runs are eligible.*|Rerunning yielded bot CI run #[0-9]+.*"
```

A rerun **mutates the same run id in place**: `run_attempt` is the test for "did aging touch this run", `head_sha` is unchanged, and there is no new run id at the same SHA to hunt for. Don't misread a long-lived active run as stranded (which would wrongly imply the gate never opens) — one `in_progress` for 12.8h had 26 jobs done and 9 started minutes earlier; key on **`status`**, never `started_at`. Never promise a time by which aging will force a run through: report the gate state (is `ci.yml` quiet, what is this run's queue position) and say plainly it may expire at the lookback without ever building. Re-dispatching CI on a draft under contention just mints another yield and another competitor for the one slot [slang priority-yield aging is CONTENTION-gated, not a timer — a yielded run can expire unrerun](../learnings/1786079520646-slang-priority-yield-aging-is-contention-gated-not.md).


## Bucket a Red by Terminal Outcome, Not by a Signature String

Whether to rerun at all depends on classifying the red, and the cheap classifier is wrong. On slang #12418 "test-server JSON-RPC breakdown = 18" came from grepping failing job logs for `JSON RPC failure`; re-deriving by **terminal failure** (the `FAILED test:` line) returned **18 again** — with a different composition (of 29 class failures: 18 terminal RPC, 7 a PR's own new CUDA test, 2 device-loss cascade, 1 autodiff assert on the PR's own tests, 1 mixed). **11 of 29 rows were misfiled**, yet the headline held because string-presence over-counted by ~11 while an independent window/denominator error under-counted by about as much — two errors of opposite sign on one figure. The string is not evidence because `slang-test` retries: in all 11 misfiled jobs it landed on a retry-*passing* test while the terminal red was a deterministic regression reproducing across SHAs, runners and platforms, where a rerun cannot succeed. Presence proves an event occurred, never that it caused the red. Two counting traps: `Too many failed tests for retry(N) - setting all to failed` promotes every pending-retry test to terminal, so one job can contribute 100+ (two such jobs supplied 200 of ~250 terminal failures in that window and dominated every per-test rate); and `failed(pending retry)` / `[Failed]:` are **first-attempt only**, so neither is a failure count.

Two durable rules follow. **A total that reproduces is not a composition that reproduces** — an unchanged challenged figure is the moment to name the members, not to relax, because offsetting errors are exactly the case where every sum check passes. And misclassification has a **direction of harm**: every misfiled row pointed at *infra*, the disposition that recommends a rerun, so calling an author-owned regression infra prescribes a rerun that cannot succeed and tells the author their red is someone else's problem. Likewise a signature-based flake rule is sound only if the signature is **absent from passing runs**; if it co-occurs with success it quietly becomes "ignore the strongest legitimate tell" [A correct total can hide a wrong composition — reclassify by TERMINAL outcome, never by signature-string presence](../learnings/1786074478624-a-correct-total-can-hide-a-wrong-composition-recla.md).

**Source learnings (24):**

- [GraphQL 401 while REST healthy — gh pr checks silently false-greens a CI sweep (recurred 2026-08-01)](../learnings/1785578978509-graphql-401-while-rest-healthy-gh-pr-checks-silent.md)
- [gh pr checks phantom-greens the CI sweep when GraphQL is 401 but REST is healthy — enumerate failures via REST check-runs + statuses](../learnings/1785586525718-gh-pr-checks-phantom-greens-the-ci-sweep-when-grap.md)
- [is:merged search broken — infer PR merge from simultaneous issue-close (github_get_issue state==closed), not is:merged](../learnings/1785572253771-is-merged-search-broken-infer-pr-merge-from-simult.md)
- [daily-report P0 candidates: label view ≠ work state — a read-only scan can't see in-flight coworker session chains, so 'missing Dev Reviewed' ≠ 'untriaged'](../learnings/1785485841108-daily-report-p0-candidates-label-view-work-state-r.md)
- [Detecting transient claude-CLI failures in A/C review runners](../learnings/1780650742331-slang-pr-review-detecting-transient-claude-cli-fai.md)
- [gh search prs misses recent open PRs](../learnings/1780327495315-gh-search-prs-misses-recent-open-prs-don-t-use-it-.md)
- [Check a PR's closing-issue link via gh closingIssuesReferences](../learnings/1780462327680-check-a-pr-s-closing-issue-link-via-gh-closingissu.md)
- [gh issue view --comments can return empty](../learnings/1782389247211-gh-issue-view-comments-can-return-empty-use-json-o.md)
- [Furo theme dark-mode code colors](../learnings/1779427288040-furo-theme-dark-mode-code-colors-use-pygments-dark.md)
- [Don't cite env-var or flag names without verifying](../learnings/1780177920997-don-t-cite-env-var-or-flag-names-without-verifying.md)
- [Verify the cited fix-PR is an ancestor of the reporter's build](../learnings/1780648573408-verify-the-cited-fix-pr-is-an-ancestor-of-the-repo.md)
- [Pushing commits is not a user-facing write](../learnings/1780726000000-pushing-commits-is-not-a-user-facing-write.md)
- [Draft-held fix PR still needs the issue 5-bullet comment](../learnings/1780900630856-draft-held-fix-pr-still-needs-the-issue-5-bullet-p.md)
- [Verify a reported release-version mismatch against the actual artifact](../learnings/1781385600632-verify-a-reported-release-version-mismatch-against.md)
- [An infra-unblock nudge is not an override of a decision-based hold](../learnings/1782719314130-an-infra-unblock-nudge-is-not-an-override-of-a-dec.md)
- [Templated operator-wake is not an explicit scoped override](../learnings/1782734222994-templated-operator-wake-explicit-scoped-override-o.md)
- [critique-gate hook false-matches read-only gh api .../pulls/... GETs as PR-creation — use gh pr view/diff --json instead](../learnings/1783806666221-approver-infra-critique-gate-hook-false-matches-re.md)
- [gh .user.login omits the [bot] suffix — edit-if-self guards must compare bare login](../learnings/1783935090568-gh-user-login-omits-the-bot-suffix-edit-if-self-gu.md)
- [[approver/clause-gap] ci_green_on_sha reads only the combined-status endpoint, not Actions check-runs — and the CodeRabbit exit-22 wait-then-reharvest works](../learnings/1784148788488-approver-clause-gap-ci-green-on-sha-reads-only-the.md)
- [Rerun supersedes attempt-1 logs — capture receipts before rerunning](../learnings/1784182764154-rerun-supersedes-attempt-1-logs-capture-receipts-b.md)
- [`gh run list --workflow <wrong-filename>` silently binds to a retired workflow and serves its old runs; enumerate paths instead of typing them.](../learnings/1786079545237-gh-run-list-workflow-wrong-filename-silently-retur.md)
- [`gh run rerun` rc=0 precedes the `run_attempt` increment; positive proof is a second call's 403 "already running", and reruns must key on (workflow_id, event, name).](../learnings/1786077463765-gh-run-rerun-returns-rc-0-before-run-attempt-incre.md)
- [Slang priority-yield aging is contention-gated (12h yield-out / 16h lookback), concludes `success` while doing nothing, and can let a yielded run expire unrerun.](../learnings/1786079520646-slang-priority-yield-aging-is-contention-gated-not.md)
- [Classify a CI red by its terminal `FAILED test:` outcome, not signature-string presence; a reproducing total can hide offsetting composition errors.](../learnings/1786074478624-a-correct-total-can-hide-a-wrong-composition-recla.md)
