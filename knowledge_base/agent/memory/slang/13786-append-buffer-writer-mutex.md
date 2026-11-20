---
type: project
title: "slang#13786 — AppendBufferWriter mutex: unlocked-without-locked in CallbackWriter, left locked if endAppendBuffer skipped"
description: "Human issue (jkwak-work): AppendBufferWriter cross-call append-buffer mutex bug → fix: thread-local per-writer buffers, draft PR #13818 (chain pre-dates records; October-reviewed head 439b8a985f, slang-reviewer R2 APPROVE_WITH_NITS). 2026-11-17 revival: merge-only refresh @ 36b08c482, tests green, codex 3-stage approve (critic back post-429-storm), CI run 44110301585 yielded-by-policy; human actions remain (review, falcor gate, ready-flip weekly list)."
---

**Issue #13786** (jkwak-work, human, open): `AppendBufferWriter`'s append-buffer mutex is unlocked
without being locked in `CallbackWriter`, and left locked if `endAppendBuffer` is skipped. Fix
direction: thread-local per-writer buffers.

**Chain provenance note:** pre-dates my records — October history lives on GitHub + fixer group
(draft PR #13818, reviewed head `439b8a985f`, slang-reviewer R2 APPROVE_WITH_NITS with nits applied;
files: source/core/slang-writer.{h,cpp}, tools/slang-unit-test/unit-test-append-buffer-writer.cpp).

**2026-11-17 15:15Z fixer [Fix Report] — revival complete (Main-verified live).** Master `2a91af5b7`
merged in; head **`36b08c482`** (Main-checked: PR #13818 head matches, open draft); **merge-only —
diff byte-identical to the reviewed head** (3 files), so the October R2 APPROVE_WITH_NITS stands, no
new review round owed. Codex PLAN/CODE/OUTPUT_REVIEW **approve this session** — notable: the kimi-k3
critic was functional again by ~15:1xZ after the 10:00–13:00Z fleet-wide 429 storm (see
[14524 record](14524-dse-store-read-by-resource-content-load.md)). Tests: cold Debug build OK;
slang-unit-test-tool 697/697 (14 ignored); tests/diagnostics 1082/1082 (10 ignored); logs in
`wt-slang-13786-revival-{build,unittest,diag}.log` (fixer group). Explanation comment re-stamped
(PR cmt 6315187105) + issue status comment updated (cmt 6315347894); explanation HTML from October
still covers the diff. CI re-dispatched — run **44110301585** (Main-checked: `waiting`, yielded by
policy on a bot draft: `wait-for-human-priority` fails by design, `falcor-build-approval-gate`
awaits human approval); stale October `waiting` run **39639634666 cancelled** (Main-checked:
`completed/cancelled`) so the queue isn't deadlocked. Fixer did NOT ready-flip — stays on the
weekly undraft list.

**Human actions remaining:** maintainer review; approve the falcor-CI gate or ready-flip.
Resume on: fixer report (CI verdict), human review activity on PR #13818, or the weekly undraft pass.
