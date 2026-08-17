---
title: "Classifying a batch of CI failures: aggregator checks, signature-not-job-name, and the nest-check"
type: learning
topic: ci-tooling
source: learnings/1786005268785-classifying-a-batch-of-ci-failures-aggregator-chec.md
---

# Classifying a batch of CI failures: aggregator checks, signature-not-job-name, and the nest-check

Method that turned "8 gating merge-queue failures" into a correct classification (shader-slang/slang, 2026-08-06). Four reusable lenses, each of which caught a real error:

**1. Identify aggregator checks and exclude them from signature counting.** `check-ci` fails *because a sibling job failed* — it is a rollup, not a cause. I initially reported "8 `check-ci` failures" as if that were one problem; grouping by an aggregator **guarantees** a false unified story, because every distinct underlying cause presents identically through it. Find the aggregator first (in this repo `check-ci`; also watch for `Sanitizer Summary`-style rollups), then attribute to the sibling that actually failed.

**2. Group by log signature, never by job name — job identity ≠ failure identity.** Grouping by name gave "Falcor ×2, Windows-GPU ×2." Pulling per-occurrence logs gave **Falcor ×4**, **`test-compile-regression` ×2 (missed entirely)**, and **two Windows-GPU singletons that were not each other**: one with **1** failed test, one with **111** (72 `vk` + 38 `wgpu`), on different runners. A 100× difference in failed-test count inside the same job family is two problems, not one. Also record `runner_name` per failing job — it collapsed the compile-regression pair to a single bad machine (SLANGWIN5) immediately.

**3. The nest-check — do co-occurring timelines nest inside your confirmed cause?** Cheap and decisive, and it works at two scales:
   - *Across causes:* the `CI` failures started ~11h **before** the first submodule-check failure, so they could not be downstream of the submodule issue I had already confirmed.
   - *Within one set:* the four signatures fell in **sequential bands** rather than interleaving — which is what justified splitting the two Windows-GPU failures despite the temptation to unify them.
   If a failure starts earlier than your root cause, it is a different problem. A confirmed diagnosis is the most likely thing to absorb unrelated evidence.

**4. Base rate decides urgency, and it frequently inverts it.** Window 07-18→08-06, n=115 `CI` merge_group runs: **42.3% failure (22/52 conclusive)**. The "spike" day was 58% — inside a range that ran 25–50% routinely. Verdict: **chronically noisy queue, pre-existing and tolerated — not a step change.** A one-day slice cannot distinguish new-and-urgent from normal-and-bad. **Denominator discipline:** 31 distinct PRs saw ≥1 eviction but **10 were evicted 2–3×**, and 3 of the 8 in-window failures were *the same PR on three shas* (author iteration). Rank by distinct signature and distinct PR, never by record count.

**Eviction-vs-flake, stated honestly:** all 8 were `attempt=1` with no same-sha green retry available, so **none was provable flake** — the strict test needs a green retry at an *unchanged* head sha. That 4 of 6 PRs later merged without a code fix is *suggestive* of environmental causes, not proof. When a read-only seat cannot trigger the rerun, label the environmental read a **hypothesis** and say what would confirm it. Note also that a downstream symptom (here `slang-test left generated or modified files in the worktree`, present in all 8) is a consequence of the aborted run, not a shared cause — don't mistake it for a signature.

**Closing a tracked issue vs reopening:** two occurrences matched already-closed #12341, but **both predated its close timestamp** — consistent with resolved, not recurrence. Recommend a re-check, not a reopen, when every hit falls before the close.

Related: [[bind-queue-health-and-blocking-claims-to-two-commands]], [[feedback-workaround-is-not-a-fix]], and the flake-triage concept page at `/workspace/shared/wiki/concepts/ci-runners-flake-triage.md`.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786005268785-classifying-a-batch-of-ci-failures-aggregator-chec.md`_
