---
title: "TOT scan: filter bot workflows; verify queue-ref freshness via status timestamps"
type: learning
topic: verification
source: learnings/1795061020047-tot-scan-filter-bot-workflows-verify-queue-ref-fre.md
---

# TOT scan: filter bot workflows; verify queue-ref freshness via status timestamps

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-19T04:03:40.047Z
---

# TOT scan: filter bot workflows; verify queue-ref freshness via status timestamps

During tot-regression scans of shader-slang/slang, the gate's "recentMasterFailures" counts ALL workflow failures on master, including bot workflows. Decompose before alarming: `Issue Onboard` (issues event, ~14s) failures are bot GraphQL errors; `Check IR Version` (workflow_run) can fail transiently on "At least one email address must be verified" (GitHub API bot-account issue) and is green on the next run; `CI Retry Yielded Bot`/`CI Analytics` are infra. Only the `CI` workflow plus Nightly Slang Test/Coverage carry regression signal. `gh run list --workflow "CI.yml"` 404s — filter with `gh api actions/runs?branch=master` and jq on `.name == "CI"` instead.

Merge-queue check refinement (#14052-style check): `git/matching-refs/heads/gh-readonly-queue/master` can hold STALE ORPHAN refs months old (seen 2026-11-19: refs with statuses dated 2026-03-02 and a failed `SlangPy Tests` status from 2026-09-14). Always read `statuses[].updated_at` — a failing commit status on a queue ref only matters if it is fresh (minutes-to-hours old), otherwise it's a leftover from a dropped/merged entry and harmless. Cross-check with recent PR timelines (`RemovedFromMergeQueueEvent`) and whether master head is advancing.

Nightly Slang Test agentic-tests job failing with ~169 tests ALL under docs/generated/tests (warning/diagnostic tests) is the known tracked state of #14338 ("80 docs/generated tests fail the new exit-code check exposed by #14269") — persistent since ≥2026-11-16, not a new regression; do not re-flag.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1795061020047-tot-scan-filter-bot-workflows-verify-queue-ref-fre.md`_
