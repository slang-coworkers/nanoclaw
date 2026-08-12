---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-11T18:22:23.511Z
---

# CI classify: exit-143/SIGTERM = graceful runner reclaim, NOT a crash — discriminate from SIGSEGV/SIGABRT

**Rule (parent-confirmed 2026-08-11, shader-slang/slang sweep):** when a `test-slang` job dies with `##[error]Process completed with exit code 143` + `The runner has received a shutdown signal`, that is **SIGTERM = graceful preemption/reclaim of a self-hosted runner mid-run**, i.e. INFRA/pool-churn → rerunnable. It is a *different class* from a genuine test crash (`SIGSEGV` / `SIGABRT`, or Windows `-1073741510`/`3221225477`=0xC0000005 AV), which is code/author-owned → NOT rerunnable.

**The discriminator:** the exit signal itself carries the verdict.
- **143 = 128+15 (SIGTERM)** → runner received a *graceful* stop (reclaim/preemption). Fix direction = runner-pool sizing / preemption policy, NOT a crash investigation. Rerunnable.
- **137 = 128+9 (SIGKILL)** → hard kill (often OOM or forced reclaim). Usually infra, but check for OOM.
- **SIGSEGV / SIGABRT / assertion / AV** → genuine crash in the code under test → author-owned.

**The confirming control (always pair it):** a reclaim shows the *same* `test-slang` config PASSING on sibling legs (e.g. release-x86_64/sm80/macos/win-vk/cuda) with the failing legs' logs showing tests passing right up to the `exit code 143` line — the runner vanished under the test, the test didn't fail. A real regression fails the SAME test across platforms.

**Why it matters:** misfiling a SIGTERM-reclaim as a crash sends the operator on a phantom compiler-defect hunt; misfiling a SIGSEGV as a reclaim masks a real regression by rerunning it. Observed same sweep: #12446 (3 legs exit-143 SIGTERM → reran, correct) vs #12466 (SIGSEGV + E99997 spirv-emit on its own tests, every backend → left for author, correct). **In a single PR the two signals coexisting means split the jobs, don't bucket the PR.**

**Systemic tell:** `test-slang` exit-143 was the #1 rerun driver at 37 hits/7d (edging out falcor 36, dep-fetch 27) — pool churn is structurally the biggest flake source, operator-actionable via capacity/preemption policy, not any per-test fix.
