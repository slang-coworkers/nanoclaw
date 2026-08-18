---
title: "A green PR check can be structurally blind: verify the suite is reachable from `pull_request` before treating it as evidence"
type: learning
topic: verification
source: learnings/1785771123651-a-green-pr-check-can-be-structurally-blind-verify-.md
---

# A green PR check can be structurally blind: verify the suite is reachable from `pull_request` before treating it as evidence

From shader-slang/slang PR #12328 (2026-08-03), verified at head `d33d6928b`.

## The trap
A one-line parser change merged with 10 green checks and 0 failures — while breaking a test in the repo. The broken test lives in a directory **no PR-triggered workflow ever executes**. Green was real; it just wasn't evidence.

Concretely in slang: `slang-test`'s default `testDir` is `tests/` (`tools/slang-test/options.cpp:740-744`). The bundles under `docs/generated/tests/` only run when something passes `-test-dir docs/generated/tests`, and the only two workflows that do are:
- `nightly-slang-test.yml` — `on: workflow_dispatch` + `cron: "0 4 * * *"`. No `pull_request`.
- `ci-slang-coverage-test.yml` — `workflow_call` only, invoked solely by `nightly-slang-coverage-test.yml` (dispatch + `cron: "0 2 * * *"`), and its own comment says agentic failures are "tolerated here so coverage data is collected either way".

`docs/generated/tests/_meta/regenerate.md` § CI integration confirms it's deliberate: the nightly run is **"Advisory only; never blocks PRs."** So a break merges green and resurfaces at 04:00 UTC attributed to whatever else ran that night.

## How to apply
When a PR's green CI is load-bearing for your review, don't ask "is CI green?" — ask **"is the suite that covers this change reachable from a `pull_request` event?"** Trace it: find the default test root in the runner's option parsing; grep `.github/workflows/` for who passes a non-default root; then read *those* workflows' `on:` blocks — and follow `workflow_call` up to the actual caller, since a called workflow's own triggers tell you nothing.

⚠ **`grep -c pull_request` on a workflow file is not a trigger check.** The nightly file had exactly one hit — `IS_FORK_PR: ${{ github.event_name == 'pull_request' … }}` at line 42, inside `jobs:`, an env expression. Confirm the hit's line number falls inside the `on:` block (`grep -n '^on:\|^jobs:\|^concurrency:'` to get the boundaries) before concluding either way.

## Don't oversell adjacent tooling as the safety net
It's tempting to say "the staleness tracker would catch it". Check first:
- `regenerate.py list-stale` reported **all 68 bundles** already stale/missing (45 stale + 23 missing) on a clean master checkout — the signal is saturated and cannot isolate a new break.
- The "Lint on PR" check that `regenerate.md` describes as an *intended* attachment point **does not exist**; no workflow runs `regenerate.py lint` or `list-stale` on PRs. Documented intent ≠ wired.

## Generated behavior-mirror tests
`docs/generated/tests/.../stmt-throw-no-semicolon.slang` existed to assert the *old* behavior (`//META: purpose=` said so literally). That makes it a behavior-mirror, not an independent requirement — updating it is not a semantic loss, which is the distinction to state when reporting the break so it doesn't read as "your fix broke a real test".

On the remedy, read the repo's own policy before prescribing: `regenerate.md` § Hand-edit policy forbids hand-edits to `.slang` files under `docs/generated/tests/<key>/`, routing fixes through (1) improve the bundle prompt + re-run generation, (2) improve the source doc — *"a docs/generated/design change is a separate PR"*, or (3) the manifest, then `mark-fresh`. And `regenerate.py` exposes **no** subcommand that rewrites a test body (list/digest/lint/verify/mark-fresh; generation is operator-driven via prompts). Useful signal for *which* route: the bundle's `watched_paths` — if the PR edits a watched path (here `source/slang/slang-parser.cpp` is watched by the very bundle that breaks), the PR itself is what makes the bundle stale by the tooling's definition, which argues the doc gets corrected first and the bundle regenerates against fixed source, plausibly as a follow-up PR. When the sanctioned route is genuinely ambiguous, say "maintainer call" rather than prescribing.

## Also
`gh` GraphQL worked this session after 401ing in several prior ones — the token blind spot is **intermittent, not permanent**. Re-test rather than pre-emptively falling back to REST; GraphQL is what confirms `closingIssuesReferences` (a typo'd `Fixes #NNNN` silently yields an empty list even though the body looks right).

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785771123651-a-green-pr-check-can-be-structurally-blind-verify-.md`_
