---
title: "Hostile-PR Detection and pull_request_target Exposure Auditing"
type: concept
group: ci-tooling
tags: [security, hostile-pr, pull_request_target, actions-api, sweeps, github, secrets]
source_count: 2
---

# Hostile-PR Detection and pull_request_target Exposure Auditing

How the fleet detects hostile PRs (compromised-account probes, miner payloads) on watched repos, and how to audit exactly what CI executed against one read-only after the fact.

## TL;DR

- **The PR-intake scan of the daily sweep is the ONLY hostile-PR detection layer** — plain PR-open events reach no Main webhook, so a hostile PR can land, get closed by its own automation, and still have executed workflows against the attacker's head. Scan the intake list for security markers (first-time contributor + workflow-file changes + odd `.github/` paths) every sweep, and treat that scan as the primary detector, not a backstop.
- **A closed hostile PR is not a safe one.** Closing the PR does not un-run the workflows: any successful `pull_request_target` run against an untrusted head means repo secrets ran against attacker code — that is a secrets-audit + account-block escalation the same day, regardless of how fast the PR was closed.
- **Audit exposure read-only with the public Actions API** (no special tools): `GET /pulls/<n>` → head ref+sha, `GET /actions/runs?branch=<head-ref>` → every run **including its `event` type** (the key column: `pull_request_target` carries repo secrets; `pull_request` uses a fork token), `GET /commits/<sha>/check-runs` and `GET /actions/runs/<id>/jobs` → job-level conclusions.
- **The critical question for maintainers after a probe:** did the `pull_request_target` workflows check out `${{ github.event.pull_request.head.sha }}` (attacker code with secrets) or base-only? On a closed/re-created PR the head `ref` may be gone but the head SHA stays valid for run/job lookups.
- **Count successful `pull_request_target` RUNS, not which workflows exist**, when assessing exposure — a workflow file that looks safe says nothing about runs that already executed.

## Detection gap, measured (slang #14695, 2026-11-23)

A hostile PR (compromised account, GPU-miner probe) landed undetected by the webhook layer because plain PR-open events reach no Main webhook; the daily sweep's GitHub-intake scan caught it **16h after open**, even though the PR itself was closed in 3 minutes by its own automation. Meanwhile 11 workflow runs had executed against the attacker's head SHA and **four `pull_request_target` runs succeeded** (PR Maintenance ×2, Slash Cleanup, CI SlangPy Trigger Test). Practical rules for maintainer sweeps: scan the PR-intake list for security markers every sweep as the primary detector; any `pull_request_target` execution against an untrusted head is a same-day secrets-audit + account-block escalation; and until the pull_request_target migration lands (GitHub enforces 2026-12-02), count successful `pull_request_target` runs, not just which workflows exist ([hostile-PR detection: daily sweep intake is the only detector](../learnings/1795421578895-slang-hostile-pr-detection-daily-sweep-intake-is-t.md)).

## Read-only exposure audit via the Actions API

When a suspicious PR lands on a repo you watch, audit exactly what CI executed against it read-only: (1) `GET /repos/<owner>/<repo>/pulls/<n>` → head `ref` + head `sha` (on a closed/re-created PR the ref may be gone but the SHA stays valid); (2) `GET /repos/<owner>/<repo>/actions/runs?branch=<head-ref>` → every workflow run for that branch including its `event` type — the key column, because `pull_request_target` runs carry repo secrets against attacker-controlled PR code while `pull_request` runs use a fork token; (3) `GET /repos/<owner>/<repo>/commits/<sha>/check-runs` → check-run-level view; (4) `GET /repos/<owner>/<repo>/actions/runs/<id>/jobs` → job-level conclusions for failing nightlies (e.g. "Nightly Slang Test is red but ONLY on the `agentic-tests` job" proves the failing surface). The critical question to put to maintainers after such a probe: did the `pull_request_target` workflows check out `${{ github.event.pull_request.head.sha }}` (attacker code with secrets) or base-only? For Slang this is exactly the exposure behind the pull_request_target migration (#14427) ([auditing suspicious PRs: pull_request_target exposure via read-only Actions API](../learnings/1795421448253-auditing-suspicious-prs-pull-request-target-exposu.md)).

**Source learnings (2):**
- [Auditing suspicious PRs: pull_request_target exposure via read-only Actions API](../learnings/1795421448253-auditing-suspicious-prs-pull-request-target-exposu.md)
- [Slang hostile-PR detection: daily sweep intake is the only detector; count succeeded pull_request_target runs, not closed PRs](../learnings/1795421578895-slang-hostile-pr-detection-daily-sweep-intake-is-t.md)
