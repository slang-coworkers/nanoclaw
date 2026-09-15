---
title: "slang-reviewer compose-and-run.sh races on shared tmp/ across concurrent PR reviews"
type: learning
topic: review-process
source: learnings/1789438517649-slang-reviewer-compose-and-run-sh-races-on-shared-.md
---

# slang-reviewer compose-and-run.sh races on shared tmp/ across concurrent PR reviews

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-15T02:15:17.649Z
---

# slang-reviewer compose-and-run.sh races on shared tmp/ across concurrent PR reviews

## Symptom
On 2026-09-15 the correctness reviewer (Reviewer A, `compose-and-run.sh`) emitted an `INTEGRITY-FAIL` while reviewing **slang-rhi#867** (CUDA copy-skip). Its `tmp/context.json` recorded `pr:868` with a **Vulkan** file list — a different PR entirely.

## Root cause
`compose-and-run.sh` writes its per-review scratch to a **shared, non-isolated** path: `/workspace/agent/slang/tmp/pr-diff.patch` and `/workspace/agent/slang/tmp/context.json`. A **concurrent** review of slang-rhi#868 (Vulkan, `fix/issue-860`) on a sibling session overwrote those shared files mid-run. The post-run integrity check then read the *other* review's polluted files and tripped. The clarity runner (Reviewer C) does **not** share this bug — it isolates scratch per-run.

## Why it's dangerous (control fired by luck)
The trip was a **false positive** here — but only because the reviewer verified by hand that A actually reviewed #867: A's captured `pr-diff.reference` sha256 (`174b0c46…0735`) was byte-identical to a fresh `gh pr diff 867` and to Reviewer C's independent diff hash, and A's `final-review.md` content was 867-specific. Absent that manual sha256 cross-check, a concurrent-review collision could surface as a **wrong-PR review reported as valid**. This is a control that passed by luck, not by construction.

## Rule
When running two `/slang-pr-review` (or `/slangpy-pr-review`) passes concurrently, the correctness runner's shared `slang/tmp/` scratch WILL race. Either (a) serialize concurrent correctness reviews, or (b) fix `compose-and-run.sh` to isolate `pr-diff.patch`/`context.json` **per-run** (mirror the clarity runner's per-run isolation), and key the post-run integrity check to the run's own captured diff hash rather than to shared `context.json`. Until fixed, always confirm the reviewed `diff_hash` matches `gh pr diff <n>` before trusting a combined verdict.

## Provenance
slang-reviewer combined review for slang-rhi#867, 2026-09-15 (verdict APPROVE_WITH_NITS; the integrity note is in the coordinator section). Diagnosed and disclosed by the reviewer itself.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1789438517649-slang-reviewer-compose-and-run-sh-races-on-shared-.md`_
