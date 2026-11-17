---
title: "Webhook Staleness & CI-Event Triage — Verify Live State Before Classifying"
type: concept
group: ci-tooling
tags: [webhooks, ci-failed, staleness, gh-cli, anonymous-access, check-runs, slang]
source_count: 5
---

# Webhook Staleness & CI-Event Triage — Verify Live State Before Classifying

A webhook is a point-in-time artifact, not current state. A `ci_failed` can re-notify a month-old failure, name a head that isn't the failing commit, or point at a run that no longer exists; a directive can arrive days late and ask for something already done. This page is the verification layer between "webhook arrived" and "dispatch work".

## TL;DR

- **A `ci_failed` webhook is a notification, not a new event** — check the PR's live timeline (last push date, runs still existing, checks count) before classifying.
- **Deleted CI runs are a fourth classification outcome**: a run 404 with the PR still open means no live run — stale event, re-dispatch `ci.yml` per the draft-PR rule (draft PRs skip auto-CI via the `filter` job's `draft != true` check), then end the turn. Verify the run exists before classifying.
- **When runs are deleted, a check suite keeps its failure conclusion and pollers keep re-reporting it** — classify as stale, don't hunt a bug.
- **A check-suite webhook's `head_sha` is the branch tip at delivery time, not the commit the failed run was built on.** Decisive check: `GET /commits/<sha>/check-runs` — `total_count: 0` proves no checks ever ran on that head. Classify the run's own job list instead.
- **A directive webhook can arrive days late** — re-read the live issue/PR thread and check whether the ask is already satisfied (merged revert PR, "Fixes #N", target changed state) before dispatching.
- **`gh workflow run` seconds after `git push` can dispatch on the previous SHA** — confirm `headSha` matches the pushed head before citing the run id.
- **Anonymous fallback when credentials die**: github.com renders anonymously (api.github.com does not); anonymous api quota is 60/h shared across the egress IP; anonymous actions-listing pages are CDN-stale — a per-run URL 404 is authoritative, a listing is not.

## ci_failed staleness: month-old re-notifications, deleted runs, and the fourth outcome

A `github.ci_failed` webhook arrived 2026-11-16 for PR #13659 whose head was pushed a month earlier (2026-10-15) with no new activity: live verification showed zero workflow runs left under the head branch (October runs deleted by repo infra, run pages 404) and only the known Oct-15 falcor-ci deployment failures in the timeline — the check-suite failure was the October state re-notified; nothing rerunnable, no action. A webhook is a *notification*, not a *new event*: check the live timeline first ([month-old ci_failed](../learnings/1794814468939-a-ci-failed-webhook-can-be-a-month-old-failure-re-.md)). When runs are deleted, a check suite keeps its failure conclusion and pollers keep re-reporting it — classify as stale, don't hunt a bug. The re-check can also find **no failing run at all** (run 38873310343 returned 404 while PR #13679 stayed open, leaving a draft-PR head with zero check runs): the decision table's three branches (priority-yield / infra-flaky / real failure) presuppose a live run, so add the fourth outcome — "no live run → stale event → re-dispatch ci.yml per the fix workflow's draft-PR rule (draft PRs skip auto-CI via the `filter` job's `draft != true` check), then end turn webhook-driven" ([deleted runs are a fourth outcome](../learnings/1794825564900-ci-failed-re-classification-deleted-ci-runs-are-a-.md)). Rider: the PR-creation critique gate hook false-positives on read-only `gh api repos/<owner>/<repo>/pulls/<n>/commits` — split the query or use a different endpoint; don't run a critique for a read.

## head_sha and dispatch-recency verification traps

Two ways a named SHA is not the SHA you think. **(1) A check-suite webhook's `head_sha` can be the branch tip at delivery time, not the commit the failed run was built on** — a webhook naming head bb7d0eca while the failing run was at the old head c514a3664b (a yielded run whose falcor-build-approval-gate timed out). The decisive check is `GET /repos/<o>/<r>/commits/<sha>/check-runs`: `total_count: 0` proves NO checks ever ran on the named head, so the suite belongs to another commit; classify the run's own job list (yield signature = wait-for-human-priority + falcor-build-approval-gate + check-ci failed, real jobs skipped) before touching code ([head_sha is the branch tip](../learnings/1794817982889-ci-failed-webhook-head-sha-is-the-branch-tip-verif.md)). **(2) `gh workflow run ci.yml --ref <branch>` run seconds after `git push` can resolve the ref to the commit before the push** — the dispatched run's `head_sha` was the old head even though `git ls-remote` already showed the new one. Check `gh run list --workflow ci.yml --branch <b> --limit 3 --json databaseId,headSha,event,status` and confirm `headSha` is the head you pushed; if not, dispatch again ([stale-revision dispatch](../learnings/1794388830841-gh-workflow-run-right-after-git-push-can-dispatch-.md)).

## Directive webhooks can be days stale

A directive webhook can arrive days late — check whether the ask is **already satisfied** before dispatching work. Measured 2026-11-16 (slang#14424): a maintainer's `@nv-slang-bot` comment asking for a reverting PR was created 11-12T16:38Z but delivered 11-16T08:45Z (~4 days, outage/redrive backlog); by then he had reverted it himself (PR #14463 merged 11-12, "Fixes #14424", issue auto-closed). The dispatched fixer no-opped correctly after reading live state — cost: one wasted turn. Before dispatching any directive (revert X, do Y), re-read the live thread and search for PRs referencing the issue number. Stale delivery is most likely during/after outage backlogs, so be extra suspicious then ([directive webhooks days stale](../learnings/1794819161666-directive-webhooks-can-be-days-stale-verify-the-as.md)).

## Anonymous fallback when container credentials die

When gh/git auth is down (gh 401, proxy-injected 401) but the repo is public, the anonymous web carries the facts: github.com website HTML renders anonymously (PR /pull/N/checks, /actions?query=branch:X, conversation timeline — deployment failure links reveal run/job IDs), while api.github.com does not, and its anonymous quota is 60/hour **shared across the egress IP** (always nearly exhausted). Read `x-ratelimit-reset` from `GET /rate_limit`, sleep to that epoch, then fire the one decisive query FIRST — within seconds other consumers drain the fresh quota. Caveat: anonymous **actions-listing pages are CDN-stale** (master's CI list showed Sep-3 as newest while master had Nov-14 commits) — never conclude "no runs after date X" from a listing; a per-run URL 404 is authoritative, a listing is not. `ncl groups connect --host api.github.com` returns `unsupported` — no self-serve reconnect; report to the operator ([anonymous web UI carries facts](../learnings/1794814468939-a-ci-failed-webhook-can-be-a-month-old-failure-re-.md), [anonymous-curl fallback and rate-limit timing](../learnings/1794817982889-ci-failed-webhook-head-sha-is-the-branch-tip-verif.md)).

**Source learnings (5):**

- [ci_failed webhook can be a month-old re-notification](../learnings/1794814468939-a-ci-failed-webhook-can-be-a-month-old-failure-re-.md) — deleted runs keep the failure conclusion
- [ci_failed head_sha is the branch tip](../learnings/1794817982889-ci-failed-webhook-head-sha-is-the-branch-tip-verif.md) — total_count:0 check-runs proves it
- [directive webhooks can be days stale](../learnings/1794819161666-directive-webhooks-can-be-days-stale-verify-the-as.md) — verify the ask isn't already satisfied
- [deleted CI runs are a fourth ci_failed outcome](../learnings/1794825564900-ci-failed-re-classification-deleted-ci-runs-are-a-.md) — no live run → re-dispatch ci.yml
- [gh workflow run can dispatch the previous SHA](../learnings/1794388830841-gh-workflow-run-right-after-git-push-can-dispatch-.md) — confirm headSha before citing

_Catalog: [index](../index.md)_
