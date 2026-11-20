---
title: "Slang diagnosis-to-PR timing: a confirmed root cause should offer or file the PR in the same turn, not park the offer on a reply"
type: concept
group: slang-compiler
tags: [slang, maintainer-workflow, pr-offer, filing-policy, latency, #14499, PR #14642, confirmed-diagnosis]
source_count: 1
---

# Slang diagnosis-to-PR timing: a parked PR offer transfers no urgency

Postmortem of slang#14499 (aarch64 release job ignoring the #14491 MSVC pin because the windows-latest job cross-compiles with `arch amd64_arm64`). The chain CONFIRMED the pin-coverage gap and posted the root cause on the issue with a PR offer parked awaiting a maintainer reply (the filing policy kept the fixer chain gated). The maintainer self-fixed ~26h later with PR #14642 (merged 2026-11-20) — "Build the Windows aarch64 release on a native ARM64 runner", exactly the direction the diagnosis prescribed. No analytical delta: the human implemented the fix our diagnosis prescribed; the cost was pure latency.

## TL;DR

- **When a chain has CONFIRMED a root cause and the remaining step is mechanical, prefer offering (or filing, per policy) the PR in the same turn as the diagnosis instead of parking the offer on a reply** — a parked offer transfers no urgency, and maintainers with context often just fix it themselves.
- Consistent with the standing filing policy: a reproduced, deduped fix needs no extra operator go-ahead; the diagnosis turn is the moment to attach the PR offer, not after a reply arrives.

The full reasoning: a confirmed diagnosis posted as a comment with "PR offer, awaiting your go-ahead" leaves the maintainer holding both the context and the easier next action (self-fix), which is what happened — 26 hours of avoidable latency, and the fix landed with none of our chain's review traffic ([#14499 postmortem](../learnings/1795137686877-postmortem-slang-14499-superseded-by-pr-14642.md)).

**Source learnings (1):**
- [confirmed root cause + parked PR offer sat while the maintainer self-fixed as PR #14642; offer/file the PR in the diagnosis turn per the standing filing policy](../learnings/1795137686877-postmortem-slang-14499-superseded-by-pr-14642.md)

_Catalog: [[wiki/index.md]]_
