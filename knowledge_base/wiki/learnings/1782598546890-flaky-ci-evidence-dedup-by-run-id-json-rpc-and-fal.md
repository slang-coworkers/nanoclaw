---
title: "Flaky-CI evidence: dedup by run id; JSON-RPC and Falcor symptoms each conflate multiple root causes"
type: learning
topic: ci-tooling
source: learnings/1782598546890-flaky-ci-evidence-dedup-by-run-id-json-rpc-and-fal.md
---

# Flaky-CI evidence: dedup by run id; JSON-RPC and Falcor symptoms each conflate multiple root causes

When compiling a consolidated flaky-infra evidence summary from the babysitter's `memory/rerun-log.jsonl`, two pitfalls will inflate counts ~6× if you grep naively:

**1. Dedup by distinct run id, not log lines.** Re-confirmation sweeps re-log the SAME eviction every 2h (same `run_id`/`mergeGroupRunId`), so raw line counts massively overcount. Group by `(.run_id // .mergeGroupRunId) | unique`.

**2. `JSON RPC failure: waitForResult/hasMessage` is a SHARED SURFACE for 3 distinct root causes** — only one is the test-server/harness infra flake:
- (a) test-server worker crash/hang with no GPU cause = the genuine harness flake (e.g. `coreDebugBridgeHandlesConcurrentMessages` CPU-concurrency test on linux-aarch64; `parameter-block.slang.4` mtl on macos-aarch64).
- (b) GPU device-loss / faulty-ICD (e.g. 580.x) killing the worker mid-RPC = a GPU-infra root cause (vkQueueSubmit device hang), NOT the harness.
- (c) a PR's OWN consistently-failing new test crashing the worker = author-owned legitimate failure (observed #11645's `11316-type-param-method-dispatch.slang` on all 5 platforms).
Exclude (b) and (c) when counting the test-harness flake. Filter out `faulty-gpu|device hang|vkqueuesubmit|580.x` and check whether the failing test is the PR's own.

**3. "Falcor" failures split into 4 buckets** — only timeout is infra-escalation material:
- **timeout** ("Process killed due to timeout", job-level ~1h52m or per-test 600s) = the infra bucket to escalate.
- **HSigmoid / relErr numeric-tolerance** = KNOWN EXTERNAL (fp16 off ~3 ULP vs Falcor's too-tight 0.0025 tol), Falcor-CI-owned, NOT Slang/infra — never fold into the timeout count.
- **unknown-vcs-root exit-1** = separate systematic Falcor-runner signature (documented in shared learnings), was quiet after ~06-16.
- **image/artifact** = separate.
Also exclude a 24h timeout on the very PR that re-routes the Falcor runner (author WIP under test, not a generic flake — was #11754).

**Why:** counted honestly over 06-17→06-27, the real buckets were Falcor-timeout 17 runs/16 PRs and aarch64 JSON-RPC harness 2 runs/1 PR — vs the ~13-run/12-PR figure a naive `JSON RPC` grep returns. Overstating flake volume to maintainers erodes trust in the escalation. The per-signature `jq` aggregations (distinct-run dedup + root-cause exclusions) are in this session's transcript.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782598546890-flaky-ci-evidence-dedup-by-run-id-json-rpc-and-fal.md`_
