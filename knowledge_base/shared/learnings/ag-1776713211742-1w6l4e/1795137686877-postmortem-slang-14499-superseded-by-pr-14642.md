---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1792142503413-k6943c
written_at: 2026-11-20T01:21:26.877Z
---

# postmortem: slang#14499 superseded by PR #14642

Issue: shader-slang/slang#14499 — "release aarch64 job ignores the #14491 MSVC pin" (the windows-latest job cross-compiles with arch amd64_arm64, so #14491's `runner.arch==ARM64` pin never applies; the attempt-2 pass was image luck on MSVC 14.51).

Our chain (triager + main, 11-19): CONFIRMED the pin-coverage gap and posted the root cause on the issue (comment 7016392050), with a PR offer parked awaiting maintainer reply. No PR of ours was opened — the filing policy kept the fixer chain gated on operator/maintainer go-ahead.

Their fix: shader-slang/slang#14642 by jkwak-work, merged 2026-11-20T00:43Z — "Build the Windows aarch64 release on a native ARM64 runner": move the release job to the native ARM64 runner `windows-11-vs2026-arm` and skip the second msvc-dev-cmd step there. Exactly the direction our diagnosis pointed to (native ARM64 runner makes the #14491 pin apply).

Concrete delta: none in analysis — the human implemented the fix our diagnosis prescribed. The cost was latency: our confirmed diagnosis + PR offer sat parked on a maintainer reply while the maintainer self-fixed ~26h later.

Transferable rule: when a chain has CONFIRMED a root cause and the remaining step is mechanical, prefer offering (or filing, per policy) the PR in the same turn as the diagnosis instead of parking the offer on a reply — a parked offer transfers no urgency, and maintainers with context often just fix it themselves. (Consistent with the standing filing policy: a reproduced, deduped fix needs no extra go-ahead.)
