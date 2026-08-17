---
title: "static-const-matrix-array .3 syn(llvm) RPC drop: harness-retry is NOT a fix; #11951 is the Signature-B tracking issue"
type: learning
topic: misc
source: learnings/1783340384337-static-const-matrix-array-3-syn-llvm-rpc-drop-harn.md
---

# static-const-matrix-array .3 syn(llvm) RPC drop: harness-retry is NOT a fix; #11951 is the Signature-B tracking issue

Triaging shader-slang/slang#11951 (2026-07-06). Two non-obvious findings for anyone who sees the `static-const-matrix-array.slang.3 syn (llvm)` test-server RPC drop on `windows-debug-cl-x86_64-gpu`.

**1. #11951 IS the tracking issue for "Signature B"** foreseen by learning 1783066436944. That note recorded only 1 occurrence (07-03 #11922) and said the parent's gate for filing a tracking issue = 3 distinct PRs. #11951 now cites 3 (#11922 run 28642587133 07-03; #11949 run 28778493820 07-06; #11914 run 28783443782 07-06) → gate met. Verified at HEAD: the two merge_group runs (#11922, #11914) are genuine FAILs; the #11949 head-check run was overall SUCCESS (flake didn't fire). So the flake is intermittent ACROSS runs.

**2. "Harden IPC with retry/reconnect" is a DEAD-END remediation for this flake — don't chase it.** In BOTH failing merge_group runs the test dropped RPC on the INITIAL pass AND on the harness RETRY (07:07→07:36 in run 28642587133; 10:43→11:11 in run 28783443782), ending as a hard `FAILED test`. slang-test already retries file tests from its saved `failedFileTests` list (slang-test-main.cpp ~6083), and file tests are immune to the unit-test PendingRetry masking (learning 1783239972308) — so this FAILED is real, and adding more retry/reconnect can't help a crashed child (nothing to reconnect to). The `waitForResult()/hasMessage()` drop is a test-server CHILD-CRASH symptom (learning 1782407732117), not an RPC-layer bug.

**Why WITHIN-run it survives retry but ACROSS runs it's intermittent:** a merge_group run has no fresh re-run to dodge the crash, so once a child crashes on the static-const-array LLVM-synthesis cluster the run is lost → merge-queue eviction (unrecoverable by rerun; bot can't enqueuePullRequest). A head-check run that never triggers the crash stays green. This is why it "clears on rerun" yet still evicts the queue.

**Triage disposition:** the shader is trivial/stable since #4392 (NOT a compiler regression); `.3 syn (llvm)` is a harness-SYNTHESIZED CPU/slang-llvm variant (beyond the 3 explicit TEST directives). Root-causing the Windows-debug child crash needs a Windows-debug + server-count-8 repro (not reproducible in a GPU-less Linux agent). Remaining options (windows-debug quarantine = masks a real crash; reduce -server-count = bot-unpushable workflow file) are maintainer design calls → parked at triaged, handed to maintainers, no bot PR. Apply NEITHER `reproduced` nor `not reproduced` when the flake is env-specific + intermittent; note the limitation.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783340384337-static-const-matrix-array-3-syn-llvm-rpc-drop-harn.md`_
