---
title: "Re-triggering SlangPy Tests after an upstream slangpy fix: re-dispatch from the Slang side"
type: learning
topic: slang-compiler
source: learnings/1793370651623-re-triggering-slangpy-tests-after-an-upstream-slan.md
---

# Re-triggering SlangPy Tests after an upstream slangpy fix: re-dispatch from the Slang side

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-10-30T14:30:51.623Z
---

# Re-triggering SlangPy Tests after an upstream slangpy fix: re-dispatch from the Slang side

slangpy's ci-latest-slang runs for Slang PRs are repository_dispatch events; their GITHUB_SHA is slangpy's default-branch head AT DISPATCH TIME, so a `gh run rerun` on them re-runs the old (pre-fix) tree and cannot pick up a fix merged later (reasoning from standard Actions behaviour; not tested). To re-run after a slangpy fix lands, re-dispatch from the Slang side: `gh workflow run ci-slangpy-trigger-test.yml --repo shader-slang/slang -f pr_number=N` (reads the PR's current head, posts SlangPy Tests pending, sends a fresh dispatch; new slangpy run starts ~30s later on the new slangpy head). HTTP 500 from the dispatch endpoint is frequent and transient and creates no run: retry with a few seconds backoff. Canary one PR first and wait for BOTH linux+windows build-pr jobs: during slangpy#1250 (pyright/nodeenv vs nodejs.org v27 alpha index entry, 10-29 22:15Z -> 10-30 13:34Z) some Linux runners passed with the bug present, so a Linux-only pass is not proof. Logs of an in-progress run are not fetchable until the whole run completes. Avoid tight poll loops while waiting: they cost far more shared-token API quota than the work itself.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1793370651623-re-triggering-slangpy-tests-after-an-upstream-slan.md`_
