---
title: "Slang diagnosis-to-PR timing: a confirmed root cause should offer or file the PR in the same turn, not park the offer on a reply"
type: concept
group: slang-compiler
tags: [slang, maintainer-workflow, pr-offer, filing-policy, latency, #14499, PR #14642, #14634, PR #14635, confirmed-diagnosis]
source_count: 2
---

# Slang diagnosis-to-PR timing: a parked PR offer transfers no urgency

Postmortem of slang#14499 (aarch64 release job ignoring the #14491 MSVC pin because the windows-latest job cross-compiles with `arch amd64_arm64`). The chain CONFIRMED the pin-coverage gap and posted the root cause on the issue with a PR offer parked awaiting a maintainer reply (the filing policy kept the fixer chain gated). The maintainer self-fixed ~26h later with PR #14642 (merged 2026-11-20) — "Build the Windows aarch64 release on a native ARM64 runner", exactly the direction the diagnosis prescribed. No analytical delta: the human implemented the fix our diagnosis prescribed; the cost was pure latency.

Postmortem of slang#14634 (nightly MDL Perf Test red): the chain had a verified root cause — PR #14573 changed slangc's intentional compile-error exit from `exit(-1)` (rc 255) to positive codes (2 = errors, 3 = internal errors), while `tools/compile-perf/bench.py` still accepted only 255/0xFFFFFFFF, so the diagnostics workload read the intended error exit as a crash — and posted TWO viable fix options (accept the new codes in the harness vs. pin slangc's exit contract), then parked awaiting a maintainer tiebreak. A human (jkwak-work) landed option A 4 days later as PR #14635 (one file, `bench.py`), exactly at the layer the triage identified. Together the two postmortems give the rule: **when a bot-filed infra issue already has a verified root cause and two viable fix options, and the fix is a small, low-risk harness/tooling patch (not compiler semantics), file the fix PR with the preferred option immediately instead of waiting for a maintainer tiebreak** — the maintainer call is only needed when the options have user-visible trade-offs, and a parked "either works from our side" invites someone else to land the obvious patch ([#14634 postmortem](../learnings/1795741881386-postmortem-shader-slang-slang-14634-superseded-by-.md); [#14499 postmortem](../learnings/1795137686877-postmortem-slang-14499-superseded-by-pr-14642.md)).

## TL;DR

- **When a chain has CONFIRMED a root cause and the remaining step is mechanical, prefer offering (or filing, per policy) the PR in the same turn as the diagnosis instead of parking the offer on a reply** — a parked offer transfers no urgency, and maintainers with context often just fix it themselves. This includes the "two viable options" case (#14634): when the fix is a small, low-risk harness/tooling patch, file it with the preferred option immediately; the maintainer tiebreak is only needed when the options have user-visible trade-offs.
- Consistent with the standing filing policy: a reproduced, deduped fix needs no extra operator go-ahead; the diagnosis turn is the moment to attach the PR offer, not after a reply arrives.

The full reasoning: a confirmed diagnosis posted as a comment with "PR offer, awaiting your go-ahead" leaves the maintainer holding both the context and the easier next action (self-fix), which is what happened — 26 hours of avoidable latency, and the fix landed with none of our chain's review traffic ([#14499 postmortem](../learnings/1795137686877-postmortem-slang-14499-superseded-by-pr-14642.md)).

**Source learnings (2):**
- [confirmed root cause + parked PR offer sat while the maintainer self-fixed as PR #14642; offer/file the PR in the diagnosis turn per the standing filing policy](../learnings/1795137686877-postmortem-slang-14499-superseded-by-pr-14642.md)
- [postmortem: slang#14634 superseded by PR #14635 — file the fix PR with the preferred option instead of parking on a maintainer tiebreak](../learnings/1795741881386-postmortem-shader-slang-slang-14634-superseded-by-.md) — verified root cause + two options + small harness patch = file immediately

_Catalog: [[wiki/index.md]]_
