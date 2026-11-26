---
title: "Slang TOT/master scan classification: stale queue refs, bot-workflow failures, runner corruption, fixture drift, and the health-snapshot fetch trap"
type: concept
group: slang-compiler
tags: [slang, tot-scan, master-scan, merge-queue, gh-readonly-queue, stale-refs, bot-workflows, merge-group, git-modules, config-lock, docs-generated, fixture-drift, ci-health-snapshot, discord-support, /tmp/opencode, curl]
source_count: 3
---

# Slang TOT/master scan classification: false positives and the health-snapshot fetch

Periodic scans of shader-slang/slang (top-of-tree regression sweeps, master health checks) keep surfacing red signals that are not compiler regressions. This page collects the verified classifications, so a scan does not escalate infra noise as master breakage, plus the one container-level trap that makes the CI-health snapshot look unfetchable. Broader CI-verdict reading and merge-queue mechanics are on the `ci-*` concept pages; this page is the Slang-scan-specific overlay.

## TL;DR

- **`gh-readonly-queue/master` matching-refs can include months-old stale refs** — check the commit's `committer.date` before treating a failing queue-ref status as an active PR drop; a ref older than a few days with a failed status is a leftover.
- **Bot workflows fail on master for infra reasons and are not compiler regressions** — classify by workflow path, not just conclusion (`Issue Onboard` GraphQL ID!/String mismatch, transient GitHub 502s, `Check IR Version`'s comment job).
- **A merge-group `CI` failure that cannot lock `.git/modules/external/*/config` for every submodule is runner workspace corruption** — zero test results in the log; the evicted PR then needs a re-queue check (`state`, `autoMergeRequest`), not a regression report.
- **Nightly-only docs/generated fixture drift after an intended emission change is staleness, not a regression** — the signature is CHECK-mismatch failures in the nightly-only corpus with green PR CI; absorb via the standing refresh.
- **In the slang-discord-support container `/tmp/opencode` is root-owned**: large `curl -o` downloads die at ~8 KB (exit 23) and look like a gateway truncation — write to a workspace path; suffix-range fetches (`curl -r -2048`) return HTTP 501 through that path.

## Stale queue refs and bot-workflow failures are scan false positives

TOT-regression scans read `gh-readonly-queue/master` matching-refs, and those can include months-old stale refs (seen 2026-11-19: two from March 2026, one from Sept with a historical "SlangPy Tests cancelled" status). Check the commit's `committer.date` before treating a failing queue-ref status as an active PR drop — a ref older than a few days with a failed status is a leftover, not a merge-queue incident. Bot workflows (`Issue Onboard`, `CI Retry Yielded Bot`, `Check IR Version`'s comment job) fail on master for infra reasons (GraphQL ID!/String mismatch in issue-onboard.yml, transient GitHub 502s) and show up in `--status failure` lists; classify by workflow path, not just conclusion ([stale queue refs and bot workflows](../learnings/1795118577115-slang-tot-scan-stale-merge-queue-refs-and-bot-work.md)). The 2026-11-25 rescan added two mechanics: queue-ref tips change between queries minutes apart (debris recycling), so a diff between two `matching-refs` snapshots is plumbing noise, not queue activity; and master CI health is now read from queue refs + per-PR `gh pr checks`, since the main "CI" workflow no longer runs on `master` directly (merge_group event) — `gh run list --branch master --workflow CI` is not the surface. The Nightly Slang Test `agentic-tests` job has been red every night since 2026-10-23, tracked by open issue #14338 (docs/generated exit-code drift, set grew ~80→172) — a tracked standing red, not a new scan finding ([merge-queue scan: date-stamp red statuses on stale gh-readonly-queue refs before flagging](../learnings/1795593879996-merge-queue-scan-date-stamp-red-statuses-on-stale-.md)).

## Runner workspace corruption evicts the PR instead of breaking master

A merge-group `CI` failure with `error: could not lock config file .git/modules/external/*/config: No such file or directory` (repeated for every submodule) is runner workspace corruption, NOT a code regression. Seen 11-19 21:41Z, run 44621335241, queue entry for PR #14622: all three linux `test-slang` jobs failed at the checkout/config step with zero test results in the log. The PR was evicted and, because it was bot-authored with no auto-merge request, sat OPEN un-requeued — after classifying, check the evicted PR's `state` and `autoMergeRequest` and report "needs re-queue" rather than treating the red merge-group run as master breakage. Distinguish from real queue breaks by grepping the log for `FAILED test:`/`error:` — this class shows only git config-lock errors ([config-lock eviction flake](../learnings/1795133431581-slang-master-scan-git-modules-config-lock-merge-qu.md)).

The same scan verified docs/generated nightly fixture drift from intended emission changes (11-18/11-19): PR #14502 "Preserve scalar and composite SSA in direct SPIR-V emission" (merged 11-18 08:03Z) staled 5 SPIR-V fixtures (eliminate-phis x2, global-var-init-moved-to-entry-point, select-ternary-selection-merge, for-init-scope-functional .4); #14511 "Fold casts of constant vectors and matrices" staled the WGSL int-vector-logical-and fixture; #14406 "CUDA: read pointer values through ImmutablePtr with __ldg" staled the two ldg-*-unrewritten fixtures. All CHECK-mismatch (emission shape) failures in the nightly-only corpus with green PR CI — fixture staleness to be absorbed by the standing #14442 refresh, not regressions [same].

## The CI-health snapshot fetch trap in slang-discord-support

In the slang-discord-support container, `/tmp/opencode` exists but is root-owned and NOT writable by user `node` — `curl -o /tmp/opencode/...` fails with exit 23 (write error) after ~8 KB, which looks exactly like a truncated/gateway-broken download ("HTTP 200 size 8192"). The 17 MB CI snapshot at raw.githubusercontent.com/shader-slang/slang-ci-analytics/main/health_snapshots.jsonl is fine upstream (HEAD shows the full Content-Length). Fix: write to a workspace path (e.g. `/workspace/agent/hs.jsonl`) instead. Suffix-range fetches (`curl -r -2048`) return HTTP 501 through this path — that is the standing precheck `ci_health: fetch_failed` cause, not a network outage ([/tmp/opencode unwritable](../learnings/1795139283089-tmp-opencode-unwritable-in-slang-discord-support-u.md)).

**Source learnings (4):**
- [stale gh-readonly-queue refs (check committer.date) and infra-failing bot workflows are scan false positives; classify by workflow path](../learnings/1795118577115-slang-tot-scan-stale-merge-queue-refs-and-bot-work.md)
- [.git-modules config-lock merge-group failure = runner corruption, PR #14622 evicted un-requeued; docs/generated nightly drift from #14502/#14511/#14406 is fixture staleness](../learnings/1795133431581-slang-master-scan-git-modules-config-lock-merge-qu.md)
- [/tmp/opencode root-owned in slang-discord-support: curl dies at ~8 KB (exit 23); write to workspace; suffix-range fetch gives HTTP 501](../learnings/1795139283089-tmp-opencode-unwritable-in-slang-discord-support-u.md)
- [merge-queue scan: date-stamp red statuses on stale gh-readonly-queue refs before flagging](../learnings/1795593879996-merge-queue-scan-date-stamp-red-statuses-on-stale-.md) — ref-snapshot diffs are noise; master CI = queue refs + per-PR checks; nightly agentic-tests red tracked by #14338

_Catalog: [[wiki/index.md]]_
