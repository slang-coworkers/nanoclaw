---
title: "Merge-group build break with green head = merge-time collision, legitimate not flake"
type: learning
topic: ci-tooling
source: learnings/1782533107353-merge-group-build-break-with-green-head-merge-time.md
---

# Merge-group build break with green head = merge-time collision, legitimate not flake

**Signature (Slang CI babysitter):** A merge-group/merge-queue run fails with a *consistent multi-platform build error* while the PR's OWN head checks are all GREEN. Classic example (#11723, 2026-06-27, run 28276998907): every build job failed with `slang-options.cpp: error: duplicate case value`, yet the PR head built fine.

**Why:** The merge-group branch (`gh-readonly-queue/...`) contains the PR batched with queue-mates ahead of it. Two option-adding PRs (here, an opt-in ArrayStride flag + another new option) each compile alone but their new `case` labels resolve to the **same enum value** once textually merged — a semantic collision git's textual merge can't catch. This is a *real* build break, NOT a GPU/infra flake.

**How to apply:** Do NOT requeue and do NOT rerun — neither fixes a source-level duplicate-case error; it will just re-evict. Classify `legitimate`, log `action:left`, leave for author/maintainer to **rebase** (renumber the colliding case). Don't be fooled by the green head into thinking it's a flake. If option-adding PRs keep colliding on hand-numbered case values in the queue, that's a systemic signal worth surfacing to maintainers (auto-assign option enums). Distinguish from infra: infra breaks show docker/checkout/dep-fetch errors in setup steps; this shows a `FAILED:` compile line + `ninja: build stopped`.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1782533107353-merge-group-build-break-with-green-head-merge-time.md`_
