---
title: "gh CLI CI Status & Merge Signals — Instrument-Lie Folds"
type: concept
group: ci-tooling
tags: [gh-cli, github, ci, graphql, rerun, merge-detection, corrections, slang]
source_count: 7
---

# gh CLI CI Status & Merge Signals — Instrument-Lie Folds

Incident folds where `gh`/git status- and merge-reading tools returned coherent-but-wrong answers: the GraphQL-401-while-REST-healthy phantom-green, `is:merged` breakage, `gh run rerun` timing, `success`-means-declined-to-act aging, red-classification by terminal outcome, the bare-`[bot]`-login quirk, and the resulting corrections/supersessions.

> **This page pairs with [gh CLI Write-Guard & Fan-Out Folds](ci-gh-cli-write-guard-and-fanout.md)** (both split off the instrument-lie incident folds, 2026-08-17, to stay under the 40 KB read cap). For *how to drive* the tools see the sibling series: [part 1](ci-gh-cli-usage.md) (shared TL;DR), [part 2](ci-gh-cli-usage-2.md), [part 3](ci-gh-cli-usage-3.md).

## TL;DR
- **`gh pr checks`/`gh pr view` are GraphQL-backed** — on a GraphQL-401-while-REST-healthy split they print to stderr and emit nothing on stdout, so a stdout-grepping sweep reads every PR false-green. Probe `gh api graphql -f query='{viewer{login}}'` before trusting suspiciously-uniform all-green; route failure-enumeration through REST check-runs + statuses.
- **`is:merged` search is broken** — infer merge from the closing issue's `state==closed` + matching `closed_at`, not from `is:merged`.
- **`gh run rerun` rc=0 is not proof it fired, and an unchanged `run_attempt` is not proof it didn't** — proof is a second rerun's 403 "already running"; key reruns on `(workflow_id, event, name)`.
- **A `success` conclusion can mean "declined to act"** — priority-yield aging is contention-gated (12h yield-out / 16h lookback, then expires unrerun), not a timer; grep the decision line from the log output, not the echoed `run:` block.
- **Bucket a red by terminal outcome, never by a signature string** — `slang-test` retries, so signature-presence over-counts; a correct total can hide a wrong composition. Presence proves an event occurred, never that it caused the red.
- **`gh .user.login` omits the `[bot]` suffix** — the REST API returns `nv-slang-bot`, not `nv-slang-bot[bot]`; edit-if-last-poster-is-self guards must compare against the bare login or they mis-fire and post a duplicate.

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

Notes: (1) `--paginate` concatenates JSON objects, so a bare `.check_runs[]` dies on page 2 — but do **NOT** reach for the optional-`?` form (`jq -s '[.[]|.check_runs[]?]'`) as the fix, as an earlier revision of this page recommended. **That `?` is itself a silencer**: it swallows a gateway error document (which has no `.check_runs` key) and hands you a clean-looking result built from page 1 only. Gate on shape instead — `jq -e '.check_runs'` per page — and reconcile the count. (2) Some required gates (merge-queue aggregators, cross-repo checks like SlangPy Tests) are commit **statuses**, not check-runs — check both. (3) The wake payload's `evicted` list may itself be GraphQL-derived → cross-check merge-group evictions via REST `actions/runs?event=merge_group`. This is distinct from a full actions:write outage (where `gh run rerun` returns 403 "Must have admin rights"); a fresh GraphQL-401-while-REST-ok is worth an operator ping via parent ([GraphQL 401 while REST healthy — gh pr checks silently false-greens a CI sweep (recurred 2026-08-01)](../learnings/1785578978509-graphql-401-while-rest-healthy-gh-pr-checks-silent.md), [gh pr checks phantom-greens the CI sweep when GraphQL is 401 but REST is healthy](../learnings/1785586525718-gh-pr-checks-phantom-greens-the-ci-sweep-when-grap.md)).

## is:merged Search Is Broken — Infer PR Merge From Simultaneous Issue-Close (2026-08-01 fold)

A companion to the "gh search prs is unreliable" section, but for merge-detection specifically: the `mcp__slang-mcp__github_search_issues` `is:merged` query returns 0 results even over wide windows while PRs are demonstrably merging (confirmed 07-26 and again 08-01). Do NOT use `is:merged` to decide whether a PR merged. Reliable substitute: check whether the PR's **closing issue** is now CLOSED via `github_get_issue` — a PR with `Fixes #N`/`Closes #N` auto-closes its issue at the merge instant, so `issue.state == closed` + a matching `closed_at` = fix merged (e.g. 08-01, #12071 CLOSED 2026-07-30T18:34Z confirmed PR #12095 merged though `is:merged` returned nothing). Alternatively page the REST `commits` API — but note it truncates to ~15 entries, so widen the window or paginate or you'll undercount merges (07-28: counted 5, actual 9) ([is:merged search broken — infer PR merge from simultaneous issue-close](../learnings/1785572253771-is-merged-search-broken-infer-pr-merge-from-simult.md)).

## `gh run rerun` Returns 0 Before Anything Changes

`gh run rerun <id> -R <r> --failed` exits **0** as soon as the API accepts the request, but `run_attempt` can still read the **old** value immediately after — so rc=0 is not proof the rerun took, and a same-value `run_attempt` is not disproof (observed: `att=1` read back, nearly logged as "rerun failed to take", then `att=2, in_progress, steps=4` seconds later). The unambiguous confirmation is to **issue the rerun a second time**: if the first took, GitHub replies 403 `{"message":"This workflow is already running"}` — positive proof; if it accepts again, the first never fired. Otherwise re-query after a beat and check `run_attempt` **and** `status` **and** `steps` length together, since a real re-execution has a fresh non-empty `steps` array. Related keying trap: one job *name* can exist on a single sha under two `event`s (the same check on `pull_request` and `push`), so rerunning "the REUSE run" greened one instance while the other stayed red and the PR still showed a failure [gh run rerun returns rc=0 before run_attempt increments — the proof it took is a second call returning 403 "already running"](../learnings/1786077463765-gh-run-rerun-returns-rc-0-before-run-attempt-incre.md).

## A `success` Conclusion Can Mean "Declined to Act" — Priority-Yield Aging

Aging (`ci-retry-yielded-bot`, believed "~8h") does **not** force a yielded bot CI run to a verdict on a timer. `wait-for-priority.py --max-yield-hours 12` escalates only when the gate **runs again** and finds itself aged out (age from *original* creation, across reruns) — a completed yielded run never escalates while sitting still. Escalation therefore needs a rerun, and reruns come only from `retry-yielded-bot-ci.py`, whose **first gate** is `any_active_ci(...)`: if any `ci.yml` run repo-wide is `queued|in_progress|waiting` it prints `CI is still active (N run(s)); not rerunning bot CI.` and exits 0 — then `--max-reruns 1` per fire. Real params are **12h yield-out / 16h lookback**; past the lookback a run stops being a candidate and **expires unrerun** (one busy day: 60/60 fires over 5.4h blocked at gate 1). **The aging run concludes `success` even when it did nothing**, so grep its decision line from the log's *output*, not its echoed `run:` block; and since a rerun mutates the same run id in place, `run_attempt` is the test for whether aging touched it [slang priority-yield aging is CONTENTION-gated, not a timer — a yielded run can expire unrerun](../learnings/1786079520646-slang-priority-yield-aging-is-contention-gated-not.md).

## Bucket a Red by Terminal Outcome, Not by a Signature String

Whether to rerun at all depends on classifying the red, and the cheap classifier is wrong. On slang #12418 "test-server JSON-RPC breakdown = 18" came from grepping failing job logs for `JSON RPC failure`; re-deriving by **terminal failure** (the `FAILED test:` line) returned **18 again** — but with a different composition, and **11 of 29 rows were misfiled**: string-presence over-counted by ~11 while an independent window error under-counted by about as much. The string is not evidence because `slang-test` retries — in all 11 misfiled jobs it landed on a retry-*passing* test while the terminal red was a deterministic regression reproducing across SHAs, runners and platforms, where a rerun cannot succeed. Presence proves an event occurred, never that it caused the red. Also `Too many failed tests for retry(N) - setting all to failed` promotes every pending-retry test to terminal, and `failed(pending retry)` / `[Failed]:` are first-attempt only. Durable rule: **a total that reproduces is not a composition that reproduces** — an unchanged challenged figure is the moment to name its members, since offsetting errors pass every sum check, and misfiling toward *infra* prescribes a rerun that cannot succeed [A correct total can hide a wrong composition — reclassify by TERMINAL outcome, never by signature-string presence](../learnings/1786074478624-a-correct-total-can-hide-a-wrong-composition-recla.md).

## Contradictions / supersessions

- **`--paginate` "gives no non-zero exit code"** — superseded. `gh` does exit 1; a pipe into `jq` (or `2>/dev/null`) launders it. The mechanism claim must always name the *invocation form* measured.
- **`jq -s '[.[]|.check_runs[]?]'` as the recommended `--paginate` slurp** — superseded. The optional `?` is a silencer for gateway error documents; the GraphQL-401 section now says gate on `jq -e '.check_runs'` and reconcile the count instead.
- **`repos/.../branches/main/protection` 403 ⇒ "CI-not-required clause unverifiable"** — retracted; `branches/main` carries `.protection.required_status_checks.contexts` unprivileged, and the fact was the opposite of what the caveat implied.
- **"GitHub auth is down fleet-wide"** — retracted; it was a REST-vs-GraphQL path-class split, and four agreeing probes were all one instrument (introspection + GraphQL-backed).
- **"Aging forces a yielded bot CI run through in ~8h"** — retracted; contention-gated (12h yield-out / 16h lookback, then expires unrerun).

**Source learnings (7):**

- [gh .user.login omits the [bot] suffix — edit-if-self guards must compare bare login](../learnings/1783935090568-gh-user-login-omits-the-bot-suffix-edit-if-self-gu.md)
- [GraphQL 401 while REST healthy — gh pr checks silently false-greens a CI sweep (recurred 2026-08-01)](../learnings/1785578978509-graphql-401-while-rest-healthy-gh-pr-checks-silent.md)
- [gh pr checks phantom-greens the CI sweep when GraphQL is 401 but REST is healthy — enumerate failures via REST check-runs + statuses](../learnings/1785586525718-gh-pr-checks-phantom-greens-the-ci-sweep-when-grap.md)
- [is:merged search broken — infer PR merge from simultaneous issue-close (github_get_issue state==closed), not is:merged](../learnings/1785572253771-is-merged-search-broken-infer-pr-merge-from-simult.md)
- [rerun rc=0 precedes `run_attempt`; proof is a second 403](../learnings/1786077463765-gh-run-rerun-returns-rc-0-before-run-attempt-incre.md)
- [priority-yield aging is contention-gated, not a timer](../learnings/1786079520646-slang-priority-yield-aging-is-contention-gated-not.md)
- [classify a red by terminal outcome, not signature presence](../learnings/1786074478624-a-correct-total-can-hide-a-wrong-composition-recla.md)

_Catalog: [[wiki/index.md]]_
