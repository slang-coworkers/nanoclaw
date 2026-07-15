---
name: project_11955_degrading_cpu_runner
description: "#11955 degrading-runner: test-linux-release-gcc-x86_64-cpu/test-slang intermittent SIGSEGV/HANG/OOM/cancel, binary-independent; now dominant flake + merge-queue evictor; jkwak-work owns; re-image ask; operator-escalation ARMED (ignored + keeps evicting)"
metadata: 
  node_type: memory
  type: project
  originSessionId: ddab6188-0f28-4222-8b37-6ae1cbb4b414
---

**#11955** — CI runner-health Infra issue: `test-linux-release-gcc-x86_64-cpu/test-slang` intermittently **SIGSEGV / HANG / OOM / cancel**, **binary-independent** (green on 8–10 sibling runners same run → it's the *runner*, not the code). Tracked, labels `CI`/`Infra`, **assigned jkwak-work**. Title already frames it as degrading-runner. Convergence lead with [[project_11951_testserver_jsonrpc_pathlevel_flake]] (same `.slang.3 syn (llvm)` boundary) posted 07-08. Maintainer jvepsalainen-nv engaged 07-09 when it began **evicting the merge queue**. Last issue comment 07-11 12:12Z (bot occurrence log, 2nd merge-queue eviction #12052).

**Escalating cost (babysitter 07-14 22:01Z):** now the **dominant flake source** — 4 log hits / 6 days, **2 today** (#12080 SIGSEGV exit139; #12086 HANG 1h20m exec-cap cancel), spanning all three modes on the SAME runner. Also stranded [[project_12052_stranded_mergequeue_operator_escalation]] (evicted it, cost an APPROVED PR a working-day+). Babysitter's ask: **operator re-image / health-check of that specific runner** — reruns only paper over a degrading-runner; the rerun spend is the waste.

**Disposition (07-14) — parallel to #11951/#11833 ladder:**
- **NOT a bot fix / NOT an operator card YET.** It's maintainer-assigned (jkwak), and the crucial gating fact: **today's compounding evidence + the re-image recommendation are NOT on the issue** (last comment 07-11). The assignee hasn't been shown the case → escalating to the operator now = premature "noisy rubber-stamp."
- **Step 1 (directed to babysitter):** post the new occurrences + the "4 hits/6d, 3 modes, same runner, degrading-runner → re-image not rerun-spend" cost-argument to **#11955** (ungated occurrence/analysis post, its established role), explicitly recommending a runner re-image/health-check and noting the merge-queue-eviction throughput cost. Notifies jkwak.
- **Why not straight to operator:** a "re-image" routes through whoever owns the NVIDIA CI runner fleet — the maintainer/their infra team, not the dashboard operator. jkwak is the right first target; I can't execute a re-image and neither realistically can the operator without going through the same infra owners.

**⚠️ OPERATOR-ESCALATION ARMED (trigger):** if BOTH — (a) the re-image ask sits on #11955 with **no maintainer/ops action**, AND (b) #11955 **keeps evicting the merge queue** (strands ≥1 more approved PR, or clusters) — THEN it graduates to an operator prioritization surface: a systemic merge-throughput problem with an *identified* fix (re-image) that isn't getting ops attention. Until both hold, maintainer owns it. (Same logic as [[project_11951...]]: worsens AND maintainer-silent → operator, not before.)
