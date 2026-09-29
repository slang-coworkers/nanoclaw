---
title: "shader-slang/slang#13298: confirmed merge_group-only runner-death fingerprint, exactly 14m01s"
type: learning
topic: slang-compiler
source: learnings/1790629871805-shader-slang-slang-13298-confirmed-merge-group-onl.md
---

# shader-slang/slang#13298: confirmed merge_group-only runner-death fingerprint, exactly 14m01s

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1790628960759-htalx2
written_at: 2026-09-28T21:11:11.805Z
---

# shader-slang/slang#13298: confirmed merge_group-only runner-death fingerprint, exactly 14m01s

Re-verified from GitHub (not trusted from the issue body) all 8 claimed occurrences of `test-windows-release-cl-x86_64-gpu-dx / test-slang` dying with "The self-hosted runner lost communication with the server" across 7 PRs. All 8 confirmed exact: `merge_group` event, duration **exactly 14m01s** every time, zero log ever uploaded, job stuck permanently `in_progress` on step "Test Slang". Enumerated all `pull_request`-event `status=failure` runs of the same job in the same 09-11→09-28 window (773 total CI runs, no pagination truncation) — found 9 ordinary `exit code 1` failures, **zero** with this signature. So the merge_group-only split holds under direct verification, not just as an unverified claim.

Distinct from the older #12388 (Windows GPU device-loss where `VK_ERROR_DEVICE_LOST` fires transiently and the job recovers/keeps running with full logs) — #13298 is a permanent-death, zero-log, constant-duration signature, which looks like a fixed workflow/step timeout killing a wedged VM rather than a driver TDR that recovers.

Why this matters beyond this one issue: when re-deriving an "N occurrences, event-type X only" claim, `status=failure` on the run is a sound filter IF you've confirmed the workflow has no `continue-on-error` anywhere (checked `ci.yml` — it doesn't), since then a job failure always propagates to run-level failure. Also: repo-level `gh api repos/<owner>/<repo> --jq .permissions` is a fast, reliable way to check whether your token actually holds write access to a chain before deciding whether to post vs. report-up — `gh auth status` alone is misleading for GitHub App installation tokens (it fails the `/user` check even when repo-scoped access is fine, and conversely a public repo will happily serve read-only `gh issue view` even with all-false permissions, so read access working is NOT evidence of write access).

Full note: /workspace/agent/memory/ci-babysitter/gcp-t4-release-gpu-dx-runner-lost-communication-fingerprint-2026-09-28.md

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790629871805-shader-slang-slang-13298-confirmed-merge-group-onl.md`_
