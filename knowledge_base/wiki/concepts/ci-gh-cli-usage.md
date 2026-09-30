---
title: "gh CLI Usage & PR/Issue Mechanics"
type: concept
group: ci-tooling
tags: [gh-cli, github, pr, issues, workflow, bot-process, slang]
source_count: 21
---

# gh CLI Usage & PR/Issue Mechanics

Concrete pitfalls and correct patterns for using the `gh` CLI in the Slang project: search limitations, closing-issue verification, comment retrieval, PR review detection, and bot process rules around GitHub writes.

**Split 2026-08-05 at the 40 KB page cap.** Everything about *how `gh`/git readings lie* — collection caps, silently-truncated arrays, endpoint splits, path-classed 401s, and the control shapes that catch them — moved to [GitHub/git Instrument Limits — Caps, Silent Truncation & Endpoint Splits](../concepts/ci-github-instrument-limits.md). This page keeps *how to drive* the tools.

> **This page is part 1 of the gh CLI Usage & PR/Issue Mechanics synthesis** (split 2026-08-07, re-split 2026-08-17 to stay under the 40 KB read cap). Siblings: [part 2](ci-gh-cli-usage-2.md), [part 3](ci-gh-cli-usage-3.md), [part 4 — instrument-lie incident folds](ci-gh-cli-usage-4.md). The TL;DR below is shared across all parts.

## TL;DR
- **`gh search` is not an existence or merge oracle.** `gh search prs`/`issues` have index lag and return false zeroes; `is:merged` has returned 0 while PRs demonstrably merge, and `is:unmerged` returned 0 even for known closed-unmerged PRs. Use the timeline, `closingIssuesReferences`, a `--head fix/issue-<n>` list, or a direct `pulls/<n>` read; for a period census, take the complete `is:merged merged:>=<ts>` list cross-checked against master commits since `<ts>`, and treat anything outside it as not merged.
- **A closing keyword can hide in the PR title or in body prose.** shader-slang/slang squash-merges with the PR title as the commit title, so a title `Fix #N: …` lands on master as a closing keyword; body prose like "(#A, which fixes #B)" also links #B. When a PR only partly fixes an issue, retitle it and reword the body, then re-check `gh pr view <pr> --json closingIssuesReferences` (never a body regex; the `owner/repo#N` long form defeats one). If #N is still listed, it is a manual Development link that needs triage rights to remove.
- **`gh issue view --comments` can print nothing at exit 0** — a renderer quirk, not an auth failure. Read `gh api .../issues/<n>` and `.../issues/<n>/comments` instead.
- **Never cite an env var, CLI flag, or command name you have not verified** via `--help`/`man`/repo grep. It is a high-frequency hallucination surface and a fabricated knob name is unrecoverable for the reader.
- **Pushing commits to a `fix/issue-*` branch is not a user-facing write** and needs no per-push approval. The gated set is narrow: PR/issue comments, review replies, reactions, `gh pr ready`, merge.
- **A draft-held fix PR does not discharge the issue comment.** `Fixes #N` in a draft body neither auto-closes nor surfaces; post the 5-bullet on the issue when you *decide* to hold.
- **`gh api .../user.login` omits the `[bot]` suffix** — never compare it raw against a review author.
- **An infra-unblock nudge is not a decision override**: being told "you're unblocked" restores capability, not authority to change a verdict.
- **A `gh` selector that resolves is not the population you meant** — a wrong `--workflow` filename silently serves a *retired* workflow's old runs; enumerate paths, never type one from memory.
- **`actions/runs?event=schedule` is not "the latest nightlies"** — it can serve months-old runs of unrelated scheduled workflows. Read each nightly's own `actions/workflows/<id>/runs`; "nightly green" means all 8 nightlies plus the weekly CMake Options run.
- **`gh run rerun` rc=0 is not proof it fired, and an unchanged `run_attempt` is not proof it didn't** (proof is a second rerun's 403 "already running"); key reruns on `(workflow_id, event, name)`, a `success` conclusion can mean *declined to act*, and a red is classified by terminal outcome, never by signature-string presence. See [part 4](ci-gh-cli-usage-4.md) for the rerun/red-classification/GraphQL-401/critique-gate incident folds.

## gh search prs Is Unreliable for Recent PRs

`gh search prs --repo <r> "<text>"` and `gh search issues` have indexing lag and gaps — they can return zero results even for open, matching PRs. Do NOT use search to determine whether an issue already has a linked PR. Use direct queries instead:

- `gh api repos/<owner>/<repo>/issues/<num>/timeline` — look for `cross-referenced` or `connected` events
- GraphQL `closingIssuesReferences` on the PR
- Branch convention: `gh pr list --repo <r> --head fix/issue-<num>`
- If the PR number is known: `gh api repos/<r>/pulls/<num>` directly ([gh search prs misses recent/open PRs — don't use it for PR-existence checks](../learnings/1780327495315-gh-search-prs-misses-recent-open-prs-don-t-use-it-.md))

Merge state has the same problem. On 2026-09-29 the slang-mcp `github_search_issues` query `is:pr is:unmerged` returned 0 even for PRs known to be closed unmerged (#13227, #13214). For a "what merged since `<ts>`" census, take the complete `is:merged merged:>=<ts>` list, cross-check it against master's commits since the same `<ts>`, and call anything outside that list unmerged. Never query `is:unmerged` directly ([is:unmerged returns false zeroes](../learnings/1790670087305-github-search-is-unmerged-unreliable-check-run-att.md)).

Note: the PR title is not the only place a closing keyword can come from. See [Checking Closing-Issue Links](#checking-closing-issue-links): on a squash-merge repo the title becomes the master commit title.

## A Name That Resolves Is Not the Name You Meant

`gh search` returning too little is the benign half of this family; the dangerous half is a selector that resolves to the **wrong population** and returns a coherent dataset for it. `gh run list --workflow retry-yielded-bot-ci.yml` returned eight `completed/success` runs dated five weeks earlier — reasonably read as "this automation is dead". That filename does not exist: `gh` bound the typo to a **retired** workflow whose *name* was the same words reordered (real path `ci-retry-yielded-bot.yml`) and served its final pre-deletion runs, while the correct path showed 15 fires in the last hour. A 404 would have been safe because it is loud; instead the answer was well-formed *and* a legitimate-looking finding, with no failure signature — the family of `|| echo 0` laundering a tooling error into a plausible datum. **Never type a workflow filename from memory**: enumerate and copy it (`gh api repos/<o>/<r>/actions/workflows --paginate --jq '.workflows[]|.path'`), which matters most in a repo like shader-slang/slang with 82 near-identically-named `ci-*` workflows [gh run list --workflow <wrong-filename> silently returns a RETIRED workflow's old runs instead of erroring](../learnings/1786079545237-gh-run-list-workflow-wrong-filename-silently-retur.md).

## Checking Closing-Issue Links

To verify a PR auto-closes an issue, use:

```bash
gh pr view <pr> -R <owner>/<repo> --json closingIssuesReferences --jq '[.closingIssuesReferences[].number]'
```

Do NOT decide from a body regex. GitHub honors both the short form (`Closes #N`) and the long form (`Closes owner/repo#N`) — a naive `keyword #N` pattern produces false-negatives for the long form. The API call is authoritative ([Check a PR's closing-issue link via gh closingIssuesReferences, not a body regex](../learnings/1780462327680-check-a-pr-s-closing-issue-link-via-gh-closingissu.md)).

Two sources of accidental closing links are easy to miss when a PR is narrowed to a partial fix ("Part of #N, which stays open for the follow-up"):

- **The title.** shader-slang/slang squash-merges with `squash_merge_commit_title=PR_TITLE`, so the PR title becomes the commit title on master, and a closing keyword in a commit that lands on the default branch closes the issue. On #12294 (2026-09-29) the body said "Part of #12291" but the title was still `Fix #12291: …`, and `closingIssuesReferences` was `[12291]`. Editing the body was not enough ([scope-narrowed PR: check the squash title too](../learnings/1790698191466-scope-narrowed-pr-check-closingissuesreferences-sq.md)).
- **Body prose.** A parenthetical like "(#13071, which fixes #13066)" in the PR body makes GitHub add #13066 to `closingIssuesReferences` (PR #13312). Reword it ("the change requested in #13066") ([closing-keyword trap in body prose](../learnings/1790673868800-stale-docs-generated-tests-retarget-prettier-3-3-3.md)).

After retitling or rewording, re-run the `closingIssuesReferences` query. If #N is still listed, it is a manual Development-panel link, which someone with triage rights must remove.

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

> **Instrument-lie incident folds moved to [part 4](ci-gh-cli-usage-4.md)** (2026-08-17): the critique-gate `gh api` write-guard false-match, the `[bot]`-suffix guard, the GraphQL-401-while-REST-healthy phantom-green, `is:merged` breakage, `gh run rerun` timing, red-classification by terminal outcome, and the associated corrections/supersessions.

## The unauthenticated Actions API `?event=schedule` can serve a stale cached page — filter master by name instead

Checking Slang nightly CI health via the **unauthenticated** GitHub Actions API, `GET /repos/shader-slang/slang/actions/runs?event=schedule&per_page=20` returned a **stale cached page** (newest run 08-30) even though nightly runs had executed that morning — it silently looked like nothing ran. It recurred on 2026-09-28: `?event=schedule&per_page=40` served June/July runs of unrelated scheduled workflows (CI Health, Populate sccache), a listing that reads like "latest schedule runs" and is not. The **reliable path is per workflow id**: list `actions/workflows?per_page=100`, keep names containing "nightly"/"cmake options", then read `actions/workflows/<id>/runs?per_page=4` for each. On slang "nightly green" means ALL of them — 8 scheduled nightlies (Slang Test, VKGLCTS, MDL Perf, Remix, Coverage, Sanitizer, Sascha, Falcor) plus the weekly CMake Options run — and in a `created=` filter the `>=` must be URL-encoded as `%3E%3D`, or the unauthenticated API returns non-JSON ([event=schedule run listing is stale — query nightlies per workflow id](../learnings/1790583283909-github-actions-event-schedule-run-listing-is-stale.md)). A cheaper approximation is `GET .../actions/runs?branch=master&per_page=100`, then client-side filter run names containing "Nightly" and take the newest per name (returns current conclusions — Nightly Slang Test / Sascha / Falcor / VKGLCTS / MDL Perf). Caveats: a burst of per-PR runs can consume the 100-run master window and push an infrequent nightly (e.g. `Nightly MDL Perf Test`) out of it — so "no runs found for workflow X in last 100" is NOT "X didn't run" (query that workflow-id's runs endpoint for its own history); and `?status=failure&per_page=N` reliably surfaces in-window failures and distinguishes schedule/master (nightly regressions) from pull_request/workflow_dispatch/merge_group events (per-PR churn, not master regressions) ([GitHub Actions API: event=schedule returns a stale page; use branch=master + name filter for nightly conclusions](../learnings/1789028374767-github-actions-api-event-schedule-returns-stale-pa.md)).

**Source learnings (21):**
- [GitHub Actions API: event=schedule returns a stale page; use branch=master + name filter](../learnings/1789028374767-github-actions-api-event-schedule-returns-stale-pa.md) — unauth event=schedule can be a stale cache; filter master runs by name for nightly conclusions

- [gh search prs misses recent open PRs](../learnings/1780327495315-gh-search-prs-misses-recent-open-prs-don-t-use-it-.md)
- [wrong `--workflow` name serves a retired workflow's runs](../learnings/1786079545237-gh-run-list-workflow-wrong-filename-silently-retur.md)
- [Check a PR's closing-issue link via gh closingIssuesReferences](../learnings/1780462327680-check-a-pr-s-closing-issue-link-via-gh-closingissu.md)
- [gh issue view --comments can return empty](../learnings/1782389247211-gh-issue-view-comments-can-return-empty-use-json-o.md)
- [Verify a reported release-version mismatch against the actual artifact](../learnings/1781385600632-verify-a-reported-release-version-mismatch-against.md)
- [Don't cite env-var or flag names without verifying](../learnings/1780177920997-don-t-cite-env-var-or-flag-names-without-verifying.md)
- [Pushing commits is not a user-facing write](../learnings/1780726000000-pushing-commits-is-not-a-user-facing-write.md)
- [Draft-held fix PR still needs the issue 5-bullet comment](../learnings/1780900630856-draft-held-fix-pr-still-needs-the-issue-5-bullet-p.md)
- [Verify the cited fix-PR is an ancestor of the reporter's build](../learnings/1780648573408-verify-the-cited-fix-pr-is-an-ancestor-of-the-repo.md)
- [Detecting transient claude-CLI failures in A/C review runners](../learnings/1780650742331-slang-pr-review-detecting-transient-claude-cli-fai.md)
- [An infra-unblock nudge is not an override of a decision-based hold](../learnings/1782719314130-an-infra-unblock-nudge-is-not-an-override-of-a-dec.md)
- [Templated operator-wake is not an explicit scoped override](../learnings/1782734222994-templated-operator-wake-explicit-scoped-override-o.md)
- [daily-report P0 candidates: label view ≠ work state — a read-only scan can't see in-flight coworker session chains, so 'missing Dev Reviewed' ≠ 'untriaged'](../learnings/1785485841108-daily-report-p0-candidates-label-view-work-state-r.md)
- [Furo theme dark-mode code colors](../learnings/1779427288040-furo-theme-dark-mode-code-colors-use-pygments-dark.md)
- [[approver/clause-gap] ci_green_on_sha reads only the combined-status endpoint, not Actions check-runs — and the CodeRabbit exit-22 wait-then-reharvest works](../learnings/1784148788488-approver-clause-gap-ci-green-on-sha-reads-only-the.md)
- [Rerun supersedes attempt-1 logs — capture receipts before rerunning](../learnings/1784182764154-rerun-supersedes-attempt-1-logs-capture-receipts-b.md)
- [event=schedule listing served months-old unrelated runs; query each nightly by workflow id (8 nightlies + weekly CMake Options), URL-encode `>=`](../learnings/1790583283909-github-actions-event-schedule-run-listing-is-stale.md)
- [GitHub search is:unmerged unreliable; check run_attempt before calling a weekly CI red](../learnings/1790670087305-github-search-is-unmerged-unreliable-check-run-att.md) — `is:unmerged` returned 0 for known closed-unmerged PRs; census via the complete `is:merged merged:>=<ts>` list.
- [Scope-narrowed PR: check closingIssuesReferences + squash title, not just the body](../learnings/1790698191466-scope-narrowed-pr-check-closingissuesreferences-sq.md) — squash title `Fix #N:` lands on master as a closing keyword; retitle, then re-check.
- [Stale docs/generated/tests retarget: prettier 3.3.3 pin, closing-keyword trap, invariant CHECKs](../learnings/1790673868800-stale-docs-generated-tests-retarget-prettier-3-3-3.md) — body prose "(#A, which fixes #B)" links #B; reword it.

_Catalog: [[wiki/index.md]]_
