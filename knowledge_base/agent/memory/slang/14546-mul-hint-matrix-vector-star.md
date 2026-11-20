---
type: chain
title: "slang#14546 — diagnostics: suggest `mul()` when `*` is used between matrix and vector"
description: Discord-requested diagnostics enhancement, filed by our own drafts batch 11-17; reopened 11-18 by tangent-vector's design direction — brief remapping in triager, fix go/no-go to operator
tags: [slang, diagnostics, enhancement, parked]
---

# slang#14546 — `mul()` hint on matrix/vector `*` (E39999)

- **Filed**: 11-17 (bot, from Discord #slang-discussion request 11-10; GLSL users write `m * v`,
  Slang/HLSL `*` is element-wise). Labels: Diagnostics → +`reproduced` 11-17.
- **Dispatch**: issue_opened → 👀 (id 662641678) + slang-triager on canonical thread
  `gh-issue-shader-slang/slang-14546` 11:39Z (my msg 13; confirmed no prior owner — the single
  14546 session was my own).
- **Triage** (triager [Report] 11:48Z, Main-verified against live issue): enhancement /
  severity low / frontend (semantic checking) / P2 normal / not a dup (related #8796, #13141).
  Reproduced on top-of-tree v2026.22-26 (`2a91af5b7`): E39999 + 21 candidate notes, no `mul` hint.
  Root surface `ResolveInvoke` (slang-check-overload.cpp:3727-3736), which already attaches the
  probe-based E40026 note for `op=` right after E39999 (:3740-3746) — the mechanism this needs.
  Rec approach A: standalone "did you mean mul(m, v)?" note gated on shapes of builtin
  matrix/vector operands (clones the merged E40026 pattern from #14246). B (note field on E39999
  def) rejected — shared by all overload failures; C (reduce candidate-note spam) deferred —
  #7857/#12969 recently tuned, behavior decision.
- **Triage post**: cmt 6947169528 at 11:48:30Z, `reproduced` applied — **DELETED 11:50Z by the
  triager's own remediation** (body preserved triager-side at memory/issues/comment-14546.md).
  Full triage memo: [raw/triage-14546.md](raw/triage-14546.md).
- **State — STOOD DOWN (batch echo, 11:50Z)**: #14546 is **our own filing** — draft 16 of the
  triager group's 2026-11-17 Discord drafts batch, filed 11:38Z, page Terminal
  (memory/issues/filing-batch-2026-11-17.md), already verified at master `818012112` in the issue
  body. My 11:39Z dispatch was an **echo misroute**: memory grep + session check were clean only
  because the batch's writes raced the webhooks. Sibling Main session c4kyqn stood the triage
  chain down; the triager deleted its comment, removed `reproduced`, cancelled re-check t-2b5446
  (verified closed). Live issue restored to filing state 11:5xZ: comments 0, labels `Diagnostics`
  only, reactions 0 (I removed my misroute-time 👀 id 662641678 to complete the restoration).
- **Disposition**: filed-only per the Terminal batch page. **No triage chain, no fixer, no public
  bot posts**; fixer handoff stays an operator/maintainer decision per the filing policy (feature
  ask). The triage brief survives triager-side (memory/issues/triage-14546.md) and Main-side
  (raw/triage-14546.md) if the operator ever green-lights a fix chain. A human comment on the
  issue is a live inbound → re-read the batch page + this record before dispatching anything.
- **Lesson (for Main dispatches)**: a bot-authored issue body that already contains verification
  results (master sha, repro status, priority) is the filing chain's own Terminal work — do NOT
  dispatch a triage chain on its `issue_opened`, even when memory grep and session lists are clean
  during a batch's write window; the batch page's per-draft disposition governs.
- **Recurrence 11-17 13:44Z (#14548, 3rd echo misroute):** the lesson fired again OUTSIDE any batch
  window — a mid-review side-find filed by the PR #14540 review chain; my dispatch raced the fresh
  filing (number-grep false-empty, no batch to read). Caught at 13:45Z reading THIS lesson; triage
  chain stood down pre-public-post. The detector is now generalized in Core Memory (memory/index.md):
  verification-results body = own filing, filed-only + report to operator, regardless of batch.
- **11-18 18:31Z — REOPENED by maintainer direction**: tangent-vector commented (cmt 6987832013,
  no @nv-slang-bot mention — live-body-verified, so NO <github-post-authorized /> was passed):
  "reasonable request" but systematic, not "a very ad-hoc path ... from within type checking
  logic" — his design: a declaration attribute that always emits a diagnostic when
  referenced/used (e.g. when overload resolution selects the candidate), plus fake
  low-overload-rank `operator*` overloads for the matrix-vector cases carrying it. **This
  supersedes the memo's approach A** (the shape-gated ResolveInvoke note is what he rejects).
  Dispatched slang-triager 18:34Z (msg 37, pinned to its chain session 5o6ju8, in_reply_to=30
  webhook row per the cross-chain recipe, delivery verified seq 22 @ 18:34:51Z): map his design
  onto the codebase, NO public posts, NO fixer.
- **11-18 18:45Z — mapped brief delivered, PARKED on operator**: triager remapped his design to the
  codebase ([raw/triage-14546-remap.md](raw/triage-14546-remap.md), 9 KB): part 1 generalizes the
  existing `[deprecated]`/`[RemovedSince]` machinery (fires at selection via ConstructDeclRefExpr
  slang-check-expr.cpp:512 → diagnoseDeprecatedAndRemovedDeclRefUsage :351-435; new attribute =
  core.meta.slang :5056 area + Attribute subclass + checkAttribute branch + new err + usage-check
  branch); part 2 fake `[OverloadRank(-N)]` overloads m×v/v×m/mixed m×m (rank is last tie-break,
  can't override conversion cost; same-shape m×m hits the #11493 builtin fast path, GLSL scope's
  rank-15 real overloads win → no false errors). ~5 files, small-to-medium, low risk; kills the
  21-note spam for free. Open details for the fixer: attribute name, suppressible vs always-error
  (suppressible ⇒ opt-in `m * v` → mul), fakes home/rank, `*=` scope (separate fakes — follow-up).
  **Operator ask posted 18:5xZ (my msg 45, canonical thread → orchestrator-dashboard)**: go =
  dispatch slang-fixer; hold = filed-only. supervisor-state updated (parked_operator_decision).
   No public posts (no bot mention in his comment); nothing owed to the triager.
- **11-19 20:33Z — r1 re-chase: still unanswered → re-presented ONCE** (rechase r1-df07): no
  operator reply on the dashboard or the chain session after msg 45; ~26 h elapsed. Dashboard row
  514512 on the canonical thread. Nothing scheduled further (per-issue recurrence forbidden); no
  triager nudge, no GitHub posts, no fix chain.
