---
title: "behind_by is not a rebase trigger — gate the remedy on PR state AND file overlap"
type: learning
topic: agent-ops
source: learnings/1786021170788-behind-by-is-not-a-rebase-trigger-gate-the-remedy-.md
---

# behind_by is not a rebase trigger — gate the remedy on PR state AND file overlap

# `behind_by > 0` is not a rebase trigger

A supervisor CI sweep sent me *"green run, BEHIND main — rebase/merge master"* on a slang-rhi chain
(2026-08-06). Two independent gates were missing, and **each alone made the remedy a no-op**.

## 1. PR state must gate any remedy computed from a run

The run was resolved **by branch**, so it pointed at a PR that had been **CLOSED for two weeks**,
while the live draft was a different PR on a different branch. An unchanged run id on a terminal PR
means **dead, not stuck**. Always fetch `state` / `draft` / `merged` before computing a remedy from
a workflow run — a branch can front several PRs across its life.

(The sweep that found this reported **7 of 30** CI nudges pointing at non-OPEN PRs. It's not rare.)

## 2. File overlap decides whether "behind" is material

The live PR really did read `mergeable_state: "behind"`, `behind_by: 6`, `status: "diverged"`. The
rebase still bought nothing:

```bash
# take merge_base_commit.sha from the first response — do NOT reuse the base ref
gh api repos/O/R/compare/<merge_base>...<head> --jq '[.files[].filename]|sort'
gh api repos/O/R/compare/<merge_base>...main   --jq '[.files[].filename]|sort'
```

My 7 files (vulkan + d3d12 device/texture/buffer + 2 tests) vs main's 21 (metal backend, a
different vulkan file, workflows, CMakeLists, docs) → **overlap: none**. `behind_by` counts
**commits on the base**, not conflicts and not invalidation. With zero overlap the existing green
still describes the code under review.

⚠ **Caveat that makes the filename tally insufficient:** overlap on a *source* file is the obvious
case, but overlap on **CMakeLists.txt, a CI workflow, or a shared header** can invalidate a green
with no source overlap at all. Read those hunks rather than trusting the count. Here main's
`CMakeLists.txt` change was +3/−0 additive (link vulkan-headers into the test target when Vulkan is
enabled), so there wasn't even a latent build interaction.

## Generalization

A nudge that names a **remedy** is a claim about **materiality**, and materiality is measurable.
Ask *what would change if I did it?* before spending a round. This is the standard
"prove your change reaches the failure" blast-radius check **run in reverse**: prove the *base's*
change reaches *you*. Cost of getting it wrong isn't zero — a rebase on a hand-off-complete draft
re-runs CI, and pushing onto an already-reviewed artifact can dismiss the review.

Related trap: answering this locally on a `--depth N` clone yields well-formed **wrong** ancestry
counts. Check `git rev-parse --is-shallow-repository`, or use the `compare` API as above.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786021170788-behind-by-is-not-a-rebase-trigger-gate-the-remedy-.md`_
