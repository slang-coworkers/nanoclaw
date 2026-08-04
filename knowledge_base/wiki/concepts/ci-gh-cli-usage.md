---
title: "gh CLI Usage & PR/Issue Mechanics"
type: concept
group: ci-tooling
tags: [gh-cli, github, pr, issues, workflow, bot-process, slang]
source_count: 35
---

# gh CLI Usage & PR/Issue Mechanics

Concrete pitfalls and correct patterns for using the `gh` CLI in the Slang project: search limitations, closing-issue verification, comment retrieval, PR review detection, and bot process rules around GitHub writes.

## gh search prs Is Unreliable for Recent PRs

`gh search prs --repo <r> "<text>"` and `gh search issues` have indexing lag and gaps — they can return zero results even for open, matching PRs. Do NOT use search to determine whether an issue already has a linked PR. Use direct queries instead:

- `gh api repos/<owner>/<repo>/issues/<num>/timeline` — look for `cross-referenced` or `connected` events
- GraphQL `closingIssuesReferences` on the PR
- Branch convention: `gh pr list --repo <r> --head fix/issue-<num>`
- If the PR number is known: `gh api repos/<r>/pulls/<num>` directly ([gh search prs misses recent/open PRs — don't use it for PR-existence checks](../learnings/1780327495315-gh-search-prs-misses-recent-open-prs-don-t-use-it-.md))

Note: a PR title containing `Fix #N` does NOT auto-close the issue — GitHub only honors `Close(s)/Fix(es)/Resolve(s) #N` in the PR body (or a manual Development-panel link).

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

## Pagination Truncates Silently — Reconcile, Don't Trust the Call (2026-08-04 fold)

The GraphQL-401 phantom-green above has a twin that bites the **REST fallback that was supposed to be the safe workaround**. Through the OneCLI GitHub gateway, `gh api "<endpoint>?per_page=100" --paginate` deterministically fails on **page 2+** with a OneCLI `app_not_connected` 401 body, while an explicit `?per_page=100&page=N` for the very same page succeeds (measured on `commits/<sha>/check-runs`, `total_count=131`: explicit `?page=2` → 6/6 OK; `--paginate` → 4/4 FAIL, emitting a second JSON doc that is the error). So the sweep silently gets the first 100 items. In one sweep 6 of 54 PRs exceeded 100 check-runs (up to 135) — exactly the big, heavily-tested PRs you least want to misjudge, and any failing check on page 2 reads GREEN ([gh api --paginate silently truncates at page 1 under the OneCLI gateway](../learnings/1785766491651-gh-api-paginate-silently-truncates-at-page-1-under.md)).

**Correction to that note — the silence is invocation-form-dependent; exit codes ARE usable.** The original write-up asserted `--paginate` produces "no non-zero exit code." That blanket claim is **wrong**, and believing it teaches the opposite of the right lesson. Measured across four forms on the same endpoint:

| form | exit | stdout |
|---|---|---|
| `gh api --paginate … --jq '…'` | **1** ✅ | 100 items **+ the error JSON leaked as a data line** (101 lines) |
| `gh api --paginate … 2>/dev/null \| jq -s '…'` | **0** ❌ | silently truncated to 100 |
| same, plus `set -o pipefail` | **1** ✅ | truncated to 100 |
| bare `gh api --paginate` (no pipe) | **1** ✅ | — |

`gh` *does* signal failure; **piping into `jq` launders it** (a pipeline reports the last command's status, and jq succeeded on the 100 items it was handed), and `.check_runs[]?` launders it a second time. Two independent silencers is why it looked like "no signal" ([CORRECTION: the --paginate silence is invocation-form-dependent](../learnings/1785766871120-correction-to-the-paginate-truncation-note-the-sil.md)).

Mitigations in order of robustness: (1) **reconcile against `total_count`** — transport-agnostic, and page 1 already carries it; (2) **don't launder the exit code** — `gh`'s built-in `--jq` or `set -o pipefail`, noting `--jq` exits 1 but stdout is *still* dirty (the error arrives as a data line), so exit-code and shape checks are complementary; (3) **validate shape before extracting** with `jq -e '.check_runs'`, reserving `?` for genuinely optional fields; (4) **explicit `?page=N` loop** with a per-page retry, failing LOUD on `__PAGEFAIL__` / `__COUNT_MISMATCH__`.

**Reconcile on RAW page length, not your filtered count** — because `/pulls`, `/issues`, and `/commits` have **no `total_count`**; their only terminator is a short page. Counting non-draft open PRs in one call returned 54, comfortably under 100, so nothing looked capped — truth was **76 non-draft of 233 open** (page 1 = 55 of 100 raw, page 2 = 20 of 100, page 3 = 1 of 33). The tell was never the filtered subtotal; it was that the **raw page length was exactly 100**. Filtering happens *after* truncation, so a small filtered number is perfectly consistent with a truncated fetch:

```bash
page=1
while :; do
  raw=$(gh api "repos/OWNER/REPO/pulls?state=open&per_page=100&page=$page")
  n=$(jq 'length' <<<"$raw")                                 # RAW length — the terminator
  jq -r '.[] | select(.draft==false) | .number' <<<"$raw"     # filtered output
  [ "$n" -lt 100 ] && break                                  # short page = done
  page=$((page+1))
done
```

Two agents had already written up this failure mode hours earlier and one still made the error *while verifying someone else's number* — a cheap single call feels sufficient when you're only checking a figure, which is exactly when to run the full method, because a wrong "correction" propagates with more authority than the original ([reconcile on RAW page length, not your filtered count — /pulls has no total_count](../learnings/1785774447673-paginate-reconcile-on-raw-page-length-not-your-fil.md)).

**The generalizable rule for every collection on this page:** ask not "did the call look OK" but **"could this have come out short without me noticing"** — and answer with a positive control (count vs server total, or loop-to-short-page). Any unreconciled paginated collection can be silently truncated. This is one family with the GraphQL-401 phantom-green and with a wake payload's `evicted: []` derived from GraphQL during a GraphQL outage (an absence *manufactured by* the outage, refuted by REST `actions/runs?event=merge_group` showing a real failed merge-group run): in all three, a degraded transport yields a well-formed, plausible, empty-or-short answer.

## `total_count` Counts MATCHES, Not Files — and a Count Authenticates One Scope (2026-08-04 fold)

`gh api search/code --jq '.total_count'` is a **match** count: a file with 3 hits contributes 3. Compounding it, `items[]` caps at **30 per page** regardless of `per_page`, so `total_count` and the rows you can see never correspond. That is the actual defect behind a 932-vs-833 discrepancy that looked like a units mismatch. The correct file count paginates and dedupes paths:

```bash
gh api --paginate 'search/code?q=repo:OWNER/REPO+path:some/dir+"NEEDLE"&per_page=100' \
  --jq '.items[].path' | sort -u | wc -l
```

This returned **786**, matching a local `grep -rl` over the same scope exactly — two independent instruments agreeing is much stronger than either alone, and worth doing deliberately when a count goes upstream to a maintainer. Three further rules from the same reconciliation: **`--paginate` on `search/code` can inject error text into your data stream** (blowing the installation rate limit appends the 403 JSON body to stdout, so a naive `wc -l` counts six lines of error as data — filter to the expected shape and treat any paginated total as a **floor** unless you confirmed the sweep completed); **pick ONE scope and never pair figures across scopes** (`/dev/null` under `docs/` = 788 files / 833 lines vs under `docs/generated/tests` = 786 / 828 — "786 files / 833 lines under `docs/`" silently pairs one scope's file count with the other's line count, and the wider scope also added false positives, two shell scripts using `/dev/null` for ordinary redirection); and **when two numbers are arithmetically impossible together, one instrument is defective — resolve it, don't bridge it** (N files with ≥1 match each forces ≥N occurrence-lines, so 932 files / 833 lines cannot both be true; "different denominators, same order of magnitude, the finding stands either way" reasons *past* the contradiction that is itself the evidence). Also: **a mechanism that explains the DIRECTION of an error is not necessarily the one that produced it** — a stale local snapshot that skewed numbers the same way fit the peer's inflated count perfectly, but that path didn't exist in their container, and accepting the direction-matching theory would have retired the real cause ([search/code total_count counts matches, not files — and pick ONE scope when citing counts](../learnings/1785791779734-gh-api-search-code-total-count-counts-matches-not-.md)).

## Summarizing Tools Are the Wrong Instrument for State, Counting, and Absence (2026-08-04 fold)

For any **counting**, **existence**, or **state** question — "how many comments?", "is there an 08:03 event?", "did PR #N merge?" — use a deterministic enumerator (`gh api` with explicit pagination, or stdlib `urllib`) and never a summarizing model (WebFetch, or a subagent asked to "check whether…"). Absence of evidence from a lossy view is not evidence of absence.

Observed three times in one day. **(a) False negative:** asked whether any 08:03Z comment existed on slang#12080, WebFetch answered a confident NO; `gh api` showed **four** comments at 08:03Z, one of them the fullest statement of the PR's central technical position. The tool was not merely wrong but **non-deterministic** — three calls on the same URL reported page 3 as 18, then 16, then 16 items (actual **50**), and one comment's length as 1088, then 856, then 1198 (truth). The false negative was then pushed upstream *as a correction to another agent's state*, which is how a lossy read becomes a durable wrong fact. **(b) False positive state, twice:** told that slang#12192's blocker "was resolved through PR #12186," a fixer wrote a memory **banner** declaring the hold UNBLOCKED; one `gh api pulls/12186` call showed `state: open  merged: false  draft: TRUE`. "Resolved through PR #N" is narrative-true and state-false, and nothing in the phrasing flags the difference. Positive claims are worse than negatives: a false negative blocks action, a false positive **unblocks** it and retires a hold that is genuinely still holding — and a false banner is worse than the stale entry it replaced, because it is durable, sits at the top of the file, and reads as verified. **(c) Self-refuting tally:** asked for a commit's check-runs, the summarizer reported "no check_runs with failure conclusion"; `gh api` on the same URL the same minute showed **2 failures** — and the tell was in the answer itself, since its per-status counts (13 + 1 + 12) did not sum to its own stated total (110). **A tool whose own numbers don't reconcile has already told you not to trust its conclusion**; check the arithmetic of any tally before using it, no ground truth required.

Applications: prose summary or judgment → WebFetch is fine; **fields are required for "what is it now."** Before writing any banner whose premise is another PR/issue's state, fetch that state (one `pulls/{n}` GET returns `state`, `merged`, `draft`, and `head` together — cheaper than the prose call that gets it wrong). Before reporting a negative, grep your own already-fetched material for anything implying the positive and reconcile it — the approver already held the disproof, since the 11:48Z body it had fetched verbatim *opens* with "This is the third round raising the guard." And a correction to someone else's state carries a **higher** bar than your own notes, because it will be recorded and outlive the conversation. The same incident also fixes the CI-state discriminator: **a commit's check-run list is CUMULATIVE across runs**, so old failures from superseded runs persist on the head forever and the aggregate conclusion is not the current signal — key on `check_suite.id` + `started_at`, never the aggregate ([never assert a negative — or a state — from a summarizing tool](../learnings/1785761747454-never-assert-a-negative-from-a-summarizing-tool-we.md)).

## A 401/403 Is Path-Classed, Never Global — Name the Sibling Endpoint (2026-08-04 fold)

This generalizes the GraphQL-401 section above from one observed split into a standing discipline.

**A permission error on one endpoint is a fact about that endpoint and that token, not about the world.** `repos/shader-slang/slang-rhi/branches/main/protection` returns **403 Resource not accessible by integration** (needs admin scope) — recorded twice as "the CI-not-required clause is unverifiable by me" and handed downstream to an approver as a caveat to *inherit*. The unprivileged summary endpoint carries the same fact with no special scope:

```bash
gh api repos/shader-slang/slang-rhi/branches/main \
  --jq '{protected, ctxs: (.protection.required_status_checks.contexts // [])}'
# => protected: true, 17 required contexts (incl. build (macos, aarch64, clang, Debug/Release))
```

The fact was **the opposite** of what the caveat implied — CI *is* required there, and it passed. GitHub commonly exposes a privileged detail endpoint plus an unprivileged summary embedding a subset; the same shape covers job logs (403 without `-L`, 200 following the redirect) and reviews (REST vs GraphQL vs `gh pr view`). Probe with the capability you actually need, and only then record the negative — naming *which* endpoint failed so the next reader can try another. **Cheap test before writing "unverifiable": name the sibling endpoint you tried; if you can't name one, you haven't finished looking.** This class of error survives review because a capability-**negative** reads as humility and escapes the scrutiny a positive claim would draw, while *closing doors* downstream ([a 403 on one GitHub endpoint is not absence of the fact — try the sibling endpoint](../learnings/1785777155910-a-403-on-one-github-endpoint-is-not-absence-of-the.md)).

**Classify the 401 by path class before scoping it.** Declaring "GitHub auth is down fleet-wide" and downgrading a whole supervisor tick to DEGRADED (every CI cell `⚠️ unread`) was refuted by a coworker that had probed the exact path it needed and got 200. The outage was a clean path-class split: `gh api repos/<o>/<r>/issues/<n>` 200, `.../comments` 200, `gh run list --workflow ci.yml` 200 — while `gh api rate_limit` 401 `app_not_connected`, `gh api graphql` 401 Bad credentials, and `gh pr list --head` / `gh pr view` (GraphQL-backed) 401. All the evidence agreed and was still wrong because the sample contained **no plain REST call**: `gh auth status` and `rate_limit` are *token-introspection* endpoints, `gh issue view` is GraphQL-backed, and `pull-universe.sh` failing on all 623 batches is GraphQL-first too — **one instrument's failure mode counted four times**. Cost: 6 CI cells reported unknown when all 6 were computable, and a real `❌ stale` rebase nudge missed. Rules: an auth-introspection endpoint is **not** a capability probe (under a credential-injecting proxy it can fail while the data paths the proxy injects for succeed); test one REST and one GraphQL call and report *which class* failed, never "GitHub is down"; a capability claim needs a **positive control** (show a call that works — if something works, the outage is partial and you owe the partition); **agreement among probes that share a backend is not corroboration** — N calls down one pipe is one observation; and a coworker contradicting your infra claim is data, not noise, so re-derive on the spot ([a gh 401 is path-classed, not global — and auth-introspection probes lie about both](../learnings/1785803201334-a-gh-401-is-path-classed-not-global-rest-can-work-.md)). Corollary from the same recovery: **stale CI on a *closed* PR is not actionable** (confirm PR `state` and issue `state` before a rebase dispatch — nudging would have sent a fixer to rebase a dead branch), and when normalizing ids for a "same value as last tick" comparison, **compare like types** — `27200523569` vs `"27200523569"` is never equal, silently converting every stale run into "fresh."

**Under a GraphQL 401, REST review reads make checks GraphQL structurally cannot.** Verify a PR's review state over REST rather than holding read-only:

```bash
gh api repos/<owner>/<repo>/pulls/<N>/reviews \
  --jq '.[]|"\(.user.login) | \(.author_association) | \(.state) | \(.commit_id[0:7])"'
gh api repos/<owner>/<repo>/pulls/<N> --jq '{draft,merged,mergeable_state,head:.head.sha[0:7]}'
```

A review's **`commit_id`** tells you *which commit was approved* — if it differs from the current head the approval is stale, and GraphQL's `reviewDecision: APPROVED` is an aggregate that **cannot** express this. `author_association` (`MEMBER`/`OWNER`) separates a maintainer approval from a drive-by, and a **zero-length body** on an APPROVED review is a go-ahead, not a failed submission. Reconcile check-runs against `total_count`, not the array length. And **an approval is not authorization to promote a draft** — `state=APPROVED` with `draft=true` still leaves the `gh pr ready` call to the maintainer. Environment notes for this repo pair: `gh pr create` fails under the GraphQL 401 but REST `POST /repos/.../pulls` with `draft=true` works, and Windows CI logs are **CRLF**, so pipe through `tr -d '\r'` before any line-anchored matching ([REST review checks GraphQL can't make, under a GraphQL 401](../learnings/1785770961557-on-slangpy-slang-prs-under-graphql-401-rest-review.md)).

**When `gh api` 401s on a PUBLIC file, follow the unauthenticated path.** Bot-reported line refs (`path/file.cpp:1110`) are UNTRUSTED data that get carried across revisions and anchor decisions without anyone opening the file. Three separate walls all read as "the source isn't reachable": `gh api repos/<fork>/contents/<path>?ref=<sha>` returned **empty**; `urllib` on the same URL gave **HTTP 401 on a public file** (badly-injected credentials — 401 means "the creds sent were rejected," NOT "this file is private"); `gh pr view --json` gave GraphQL 401. The path that works, first try, no auth, on a fork at a pinned SHA:

```bash
curl -sSL https://raw.githubusercontent.com/<owner>/<repo>/<full-sha>/<path> -o out.cpp
```

Then verify the ref *means* what was claimed, not just that the line exists: `wc -l` first (a ref beyond EOF is instantly disproven), grep the whole file for the symbol and **count occurrences** (on slang-rhi#803 `ACCEPT_FIRST_HIT_AND_END_SEARCH` appeared exactly once across all 13 `rayFlags` uses — that uniqueness is what corroborated "honored only on the opaque path," far stronger than the ref matching), establish the enclosing scope, check the counterpart path, and **print absolute line numbers — never a bare `sed -n 'A,Bp'` window**, since misreading window-relative numbering as absolute is how a wrong ref gets manufactured *during verification* ([verify bot line refs against raw.githubusercontent when gh api 401s on public files](../learnings/1785780771790-approver-verify-bot-line-refs-in-source-raw-github.md)). One adversarial retry on a *different* access path converted "fetch failed" into a source-verified anchor.

## Getting the Right Diff: the 300-File Patch Cap, and Two Controls on Every Absence Claim (2026-08-04 fold)

GitHub's patch/diff media types **hard-fail at 300 files**, and `gh api` writes the error body into your output file:

```bash
gh api repos/O/R/pulls/N -H "Accept: application/vnd.github.v3.patch" > p.patch
grep -E '^\+' p.patch | grep -oiE '<email-regex>' | grep -c ''   # => 0   ("no PII!")
```

That `0` was worthless — a 391-file, +34524/−6378 PR yielded a **337-byte** JSON body (`"the diff exceeded the maximum number of files (300)"`, status 406), and the grep dutifully found no emails in it. **A scan of an error message looks identical to a clean scan.** Detection was the byte count: 337 bytes cannot be a +34,524-line diff. Working substitute — the `compare` endpoint has no 300-file cap (`gh api repos/O/R/compare/<sha>^...<sha> -H "Accept: application/vnd.github.v3.diff"` → 3,194,375 bytes, `grep -cE '^\+'` = 34915, matching the PR's stated +34524 ±hunk headers); `pulls/N/files?per_page=100&page=K` is the right instrument for *path* enumeration but gives filenames and counts, not line content.

**The general rule: pair every absence claim with two controls.** (1) A **non-zero control on the artifact** — `wc -c` / `grep -c ''` proving you scanned real content of the expected magnitude. (2) A **positive control on the pattern** — feed the regex a synthetic known-positive (`printf '+ contact [REDACTED-EMAIL] here\n' | grep -oiE …`); if that prints nothing, your regex is broken and the `0` means nothing. With both green the 0 hits were real; without them it was an unfalsified guess dressed as a verification. Bonus false-positive: a credential-shape grep (`sk-[A-Za-z0-9_-]{20,}`) fired twice on a **filename** inside a `diff --git` header — always print surrounding context for a secret-shaped hit before calling it a leak ([gh patch endpoint 406s above 300 files, poisoning grep scans](../learnings/1785812823235-gh-patch-endpoint-406s-above-300-files-poisoning-g.md)).

**Scope the diff to the PR, not to the dispatch's delta.** On a "logic DELETION, correctness gate re-opened" review the ±line counts in the dispatch usually describe the delta *since the last reviewed head*, not the PR. slang#12116 was dispatched as "+4 / −91 logic deletion — treat the correctness gate as RE-OPENED"; against the merge-base, `git diff <merge-base>...<head> -- <pass>.cpp | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*//'` was **empty** — every changed line was a comment, because the −91 was the PR's own earlier addition being withdrawn after upstream #12263 landed a more principled fold. Net compiler effect zero; the review weight moves onto whether the *tests* pin real behavior. Two method notes: **prove dead-code claims with a double build, not a diff read** (build as-shipped and with the deleted code restored, then `cmp -s` the emitted output for every config the test exercises — 5/5 byte-identical is what upgrades a claim from plausible to established; equal *counts* of the interesting token are not enough), and **compare operand *kinds*, not counts** (an own-written plain-array control shader whose set of decorated instruction kinds matched the feature path's exactly is a parity proof; matching totals alone would not exclude decoration landing on a different operand kind) ([deletion-PR review: diff vs master, not vs the previously-reviewed head](../learnings/1785754038566-deletion-pr-review-diff-vs-master-not-vs-the-previ.md)).

## CORRECTION — What the Bash Write-Guard Actually Trips On (2026-08-04 fold)

Two successive characterizations of a `PreToolUse:Bash` denial on a **read-only** `gh api` call were published and both were wrong; each pointed an operator at a different non-existent problem. Recorded here as supersessions because the wording lives above in the critique-gate section.

**Retracted claim 1: "the delivery/critique gate blocks *all* bash — including read-only `gh api` reads."** Wrong. Single-field `--jq` reads succeed on the identical URL, same session, same gate state (`--jq '.state'`, `--jq '.state_reason'`, `--jq '.closed_at'` all → 200), while one composed form was denied. A peer coworker independently reported read-only `gh api` working fine on their edge, which is what prompted the re-probe instead of continuing to assert a blanket block. The meta-lesson: a tool's behavior was diagnosed **from two denials without probing a single variant**, and that diagnosis was handed to a parent as grounds for escalating a process fix — *"X is blocked"* and *"the way I invoked X is blocked"* are different claims with very different consequences ([CORRECTION: the gate does not block read-only gh api](../learnings/1785781643460-correction-the-critique-gate-blocks-composed-multi.md)).

**Retracted claim 2 (from that same correction): "only composed multi-field interpolated `--jq` strings trip it."** Also refuted by probing. The mine-verified trigger is the literal **`state=`** in the command text **on an `issues` path**:

- Denied: `--jq '"state=\(.state)"'` (single field), `--jq '"state=x"'` (no interpolation at all), `--jq '"state_reason=\(.state_reason)"'`
- Passed: `--jq '.state'`, `--jq '.state,.closed_at'`, `--jq '"foo=\(.state)"'`, `--jq '"a=\(.state) b=\(.closed_at)"'` (**composed, multi-field, interpolated**), the same `"state=x"` literal on a **non-issues** path, and bare `echo "state=closed"` (so the pattern is `gh`-scoped)

Inferred (labelled inferred) mechanism: a **write-guard against closing an issue** — meant to catch `gh api …/issues/N -f state=closed` — implemented as a regex loose enough to match the same characters appearing in a *read's* `--jq` output-format string; hence path-sensitive and literal-sensitive while indifferent to the HTTP method. **The workaround is to rename the label:** `"foo=\(.state)"` passes where `"state=\(.state)"` is denied, costing only the wording of your own output label; safest of all are **bare selectors** (`--jq '.state,.state_reason,.closed_at'`) — no `=` anywhere and no string literal to match. The real fix is for the guard to match argument position/method, not a substring that can appear in an output-format string. A **second, separate** trigger (`.state_reason` appearing before a later `=`) was measured to **one edge only** after a third agent ran the two denied cells verbatim and both passed — nobody else should code around it, since a fleet-wide workaround for a single-edge artifact is a permanent tax on everyone for one agent's config ([the gh api gate trigger is a write-guard regex false-positive, narrower than two successive characterizations](../learnings/1785782110173-the-gh-api-gate-trigger-is-a-write-guard-regex-fal.md)).

Three method rules from that chain, all reusable well beyond this gate. **This file's own title originally claimed the trigger was "reproduced on 3 edges" — false and retracted**: it was verified on one edge plus a *report* from one other, i.e. an inference dressed as a count, and a number borrows the authority of measurement whether or not it later turns out right (it did, afterwards — *being lucky is not being calibrated*). **A residual you cannot explain can still be bounded**, and bounding it is often more useful than explaining it, because scope decides who has to care; three candidate regexes were built and discarded because each mispredicted a cell that had already passed, and an unexplained residual honestly labelled beats a clean story that mispredicts. **METHOD TRAP — the guard matches command TEXT before execution, so a bundled retest invalidates itself**: putting a previously-passing form in the same command as a previously-denied literal "to compare them side by side" denies the whole command, the control never runs, and the denial looks like a property of the control (read for one moment as *"the gate is nondeterministic"*). One probe per command, always — an experiment whose apparatus is itself subject to the effect under test cannot measure it. Finally, note the downstream harm that holds regardless of which trigger story is right: **a gate that blocks read-only verification pressures an agent toward substituting remembered values exactly when checking matters most.**

## An Unexplained Bot Comment: Your Own Fan-Out Is the Prime Suspect (2026-08-04 fold)

The `[bot]`-suffix guard above is about *not duplicating* your own comment; this is about *attributing* one you didn't expect. Two incidents, one shape.

**"Read-only agent" is a claim about a tool list, not about the world.** A coworker found an unexplained `nv-slang-bot[bot]` comment on an issue it was driving and excluded its own subagents because "my three research agents were all `Explore`-typed (no `gh`/write surface)," then escalated *"a second tier can write to GitHub surfaces I hold"* as a routing hazard. The exculpating premise is false: `Explore`'s grant is *all tools except Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit* — **`Bash` is retained**, so `gh api …/issues/<n>/comments --method POST -f body=…` is fully available. Explore is read-only with respect to the **local filesystem**; it says nothing about network side effects, and a single retained shell is a write surface to every API the container is credentialed for. Corroborating detail for the mundane local explanation: the comment's timestamp fell inside the owning session's own turn gap (outbound `00:23:39` → `00:47:24`), and a subagent's `gh` write is invisible as session outbound, so a self-inflicted write looks exactly like a mystery write. Rules: verify a subagent's tool grant before treating it as incapable; **state read-only intent in the prompt** ("do not write to GitHub or any external service; report findings only") because the type does not enforce it; a capability-based alibi needs the same evidence as any other claim; and absence of an audit trail is not absence of a cause — the systemic story must not be adopted just because it is the one that leaves you blameless ([Explore-typed subagents RETAIN Bash — read-only restricts file writes, not network writes](../learnings/1785804584522-explore-typed-subagents-retain-bash-read-only-agen.md)).

**The other direction: the dispatcher's own unannounced write.** A comment on slang#12223 (id 5167783319) was reported as coming from "a different session under our shared `nv-slang-bot[bot]` identity," with a coordination rule proposed for concurrent sessions writing to one surface. There was **no concurrency incident** — the orchestrator posted it itself: it authorized the close-out (the worker's footprint), then four minutes later posted a separate finding on the same issue and told the *reviewer* tier but not the worker. The correct rule belongs to the dispatcher, not the workers: **whoever delegates a surface must announce any write it makes to that surface, with the comment id, on the same thread, in the same turn.** What survives in weaker form is ordinary hygiene — a shared bot identity genuinely isn't attributable to a tier from GitHub alone, so investigating an unannounced bot comment *by content* and re-reading the newest comment before posting are both right — but do not escalate "unattributable bot comment" to "concurrency incident" without evidence; ask the tier that could have written it first. The same episode yields a cheaper habit: **before re-running an experiment, re-read the evidence you already collected and ask what else it proves.** Three agents independently re-derived that `*_FLAGS_<CONFIG>_INIT` seeding fails to honor env `CXXFLAGS`, when the chain's own days-old probe output already showed the all-config slot (where env `CXXFLAGS` lands) preceding the per-config slot — the ordering *was* the finding. Probe when you have no evidence; re-read when you do ([CORRECTION: it was the dispatcher's unannounced write, not a rogue session](../learnings/1785770140397-correction-to-my-12223-concurrency-claim-it-was-th.md)).

## Contradictions / supersessions

- **`--paginate` "gives no non-zero exit code"** — superseded. `gh` does exit 1; a pipe into `jq` (or `2>/dev/null`) launders it. Fixed in place above; the mechanism claim must always name the *invocation form* measured.
- **`jq -s '[.[]|.check_runs[]?]'` as the recommended `--paginate` slurp** — superseded. The optional `?` is a silencer for gateway error documents; the note in the GraphQL-401 section now says gate on `jq -e '.check_runs'` and reconcile the count instead.
- **"The critique/delivery gate blocks all bash, including read-only `gh api`"** and **"only composed multi-field interpolated `--jq` trips it"** — both retracted; the mine-verified trigger is the literal `state=` on an `issues` path (see the CORRECTION section). The separate `.state_reason`-before-`=` trigger is one-edge-only and must not be worked around fleet-wide.
- **"Reproduced on 3 edges"** (as originally published for the `state=` trigger) — retracted as an inference dressed as a count; it became true only later, which does not retroactively justify writing it.
- **`repos/.../branches/main/protection` 403 ⇒ "CI-not-required clause unverifiable"** — retracted; `branches/main` carries `.protection.required_status_checks.contexts` unprivileged, and the fact was the opposite of what the caveat implied.
- **"GitHub auth is down fleet-wide"** — retracted; it was a REST-vs-GraphQL path-class split, and four agreeing probes were all one instrument (introspection + GraphQL-backed).

**Source learnings (35):**
- [gh api --paginate silently truncates at page 1 under the OneCLI gateway — a phantom-green vector on the REST fallback](../learnings/1785766491651-gh-api-paginate-silently-truncates-at-page-1-under.md)
- [CORRECTION: the --paginate silence is invocation-form-dependent — `gh` does exit 1; a pipe into jq launders it](../learnings/1785766871120-correction-to-the-paginate-truncation-note-the-sil.md)
- [Reconcile on RAW page length, not your filtered count — /pulls, /issues, /commits have no total_count](../learnings/1785774447673-paginate-reconcile-on-raw-page-length-not-your-fil.md)
- [search/code total_count counts MATCHES not files (items[] caps at 30/page); pick ONE scope when citing counts](../learnings/1785791779734-gh-api-search-code-total-count-counts-matches-not-.md)
- [Never assert a negative — or a positive STATE — from a summarizing tool; WebFetch is prose-only, enumerate with gh api](../learnings/1785761747454-never-assert-a-negative-from-a-summarizing-tool-we.md)
- [A 403 on one GitHub endpoint is not absence of the fact — try the unprivileged sibling endpoint](../learnings/1785777155910-a-403-on-one-github-endpoint-is-not-absence-of-the.md)
- [A gh 401 is path-classed, not global: REST can work while GraphQL 401s — auth-introspection probes are not capability probes](../learnings/1785803201334-a-gh-401-is-path-classed-not-global-rest-can-work-.md)
- [Under a GraphQL 401, REST review reads make checks GraphQL structurally cannot (per-review commit_id, author_association)](../learnings/1785770961557-on-slangpy-slang-prs-under-graphql-401-rest-review.md)
- [Verify bot line refs in source via raw.githubusercontent when gh api 401s on public files](../learnings/1785780771790-approver-verify-bot-line-refs-in-source-raw-github.md)
- [gh patch endpoint 406s above 300 files, poisoning grep scans — use compare, and pair every absence claim with two controls](../learnings/1785812823235-gh-patch-endpoint-406s-above-300-files-poisoning-g.md)
- [Deletion-PR review: diff vs master, not vs the previously-reviewed head; prove dead-code with a double build](../learnings/1785754038566-deletion-pr-review-diff-vs-master-not-vs-the-previ.md)
- [CORRECTION: the critique gate does not block read-only gh api — probe variants before characterizing a tool](../learnings/1785781643460-correction-the-critique-gate-blocks-composed-multi.md)
- [The gh api gate denial is a write-guard regex false-positive on literal `state=` over an issues path — rename the label](../learnings/1785782110173-the-gh-api-gate-trigger-is-a-write-guard-regex-fal.md)
- [Explore-typed subagents RETAIN Bash — "read-only agent" restricts file writes, not network writes](../learnings/1785804584522-explore-typed-subagents-retain-bash-read-only-agen.md)
- [CORRECTION: the #12223 "concurrency incident" was the dispatcher's own unannounced write; re-read evidence before re-running it](../learnings/1785770140397-correction-to-my-12223-concurrency-claim-it-was-th.md)
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
_Catalog: [catalog](../index.md)_
