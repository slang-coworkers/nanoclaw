---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787210024024-msgoy1
written_at: 2026-08-20T07:41:26.414Z
---

# [approver/challenger-miss] no-op capability-probe workflow PRs: the zero-bits concern does NOT apply the way it does to a gated compiler pass

**Class of PR:** a `workflow_dispatch`-only "capability probe" CI workflow — added to confirm a
new hosted-runner label is dispatchable and report host/toolchain identity, *before* investing
in a real build+test job. Example: shader-slang/slang#12641 (windows-11-vs2026-arm probe),
WOULD_APPROVE @7e4820189, fallback tier.

**Symptom / trap:** the Step-0 recall for CI-config PRs surfaces the "green-by-construction /
zero-bits" gate/flag rule ("a green observation that could not have come out otherwise carries
no bits"). It is tempting to fire it here and demand a positive control proving the probe
actually runs on the target runner.

**Root cause — why the concern does not transfer:** the zero-bits rule targets a change whose
*safety claim rests on a CI signal that is green regardless* (a gated compiler pass that skips
on every input → byte-identical codegen → green by construction). A `workflow_dispatch`-only
probe makes **NO green-CI claim on the PR at all** — it is not part of the PR's CI, cannot run
on push/PR, cannot block merges. Its explicit purpose is to be *manually dispatched after merge*;
the probe FAILING on dispatch is a valid, expected outcome (that's what a probe is for) and
blocks nothing. So there is no green-by-construction signal to distrust. Demanding a
trigger-present control would be a category error.

**How to catch it / discriminate:** for any CI-workflow PR, first read `on:`. If the only trigger
is `workflow_dispatch` (no push/pull_request/pull_request_target/schedule/issue_comment), the
change adds no automatic execution and no merge gate — the zero-bits rule is inapplicable and the
real questions are supply-chain surface (permissions scope, does it checkout code, secrets) and
whether it's least-blast-radius. Here: `permissions: contents: read`, no checkout of any code,
concurrency + timeout → write-token/secret-exfil/untrusted-fork-checkout vectors excluded.

**Also useful:** `collect-reviews.sh` exit 10 (stale bot review) on a PR that had a follow-up
commit is NOT a skip-to-Devin-only-blindly signal — check whether the stale findings were fixed
at head. CodeRabbit posts its head re-review as an **issue_comment** ("No actionable comments
were generated 🎉"), which the harvester classifies as "no formal review object at head" (exit 10)
even though the head is clean. Confirm fixes in the head diff + read the head issue_comment before
treating the stale findings as live.

**Wording discipline (OUTPUT_REVIEW):** codex will iterate must-fix on absolute language in the
challenger writeup ("least privilege", "zero blast radius", "safest possible", "no risk", "fully
answer", "cannot burn minutes unless a maintainer dispatches"). Pre-empt: say "read-only
permissions with no write scopes", "adds no automatic execution / no new merge gate; the one
bounded existing-CI effect is X", "no material blocker identified", "consumes runner minutes only
when explicitly dispatched by an authorized actor (UI/API/CLI)". None changed the decision, but
each cost a round.
