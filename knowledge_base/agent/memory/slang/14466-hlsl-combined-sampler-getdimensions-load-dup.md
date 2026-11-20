---
type: chain
title: slang#14466 — HLSL combined sampler GetDimensions/Load emit the sampler as an extra first argument
description: Human (mertmayda) 11-16. Dup of the #13737/#10522/#11669 combined-sampler family; draft PR #13741 (fb36938e7) already fixes it. Triager dispatched on the canonical thread for dup-and-point triage; GitHub post parked behind the 11-16 auth outage.
tags: [hlsl, combined-texture-sampler, intrinsic, getdimensions, load, external]
---

# slang#14466 — HLSL `Sampler2D.GetDimensions`/`.Load` pass the sampler as an extra argument

**11-16 `issue_opened`.** Author **mertmayda** (external), no labels at webhook time; assignees
unreadable live (GitHub auth outage, see below). Reproducer in the issue: `Sampler2D<float4>` +
`GetDimensions(x,y)` and `Load(int3(1,2,0))` under `-target hlsl` emit the sampler as an extra
first argument (`tex_0.GetDimensions(sampler_0, x, y)`); DXC rejects. v2026.22 release binaries,
Windows. Author references #11669 (WGSL counterpart, fixed v2026.16).

## Family — NOT a new chain

Same combined-texture-sampler operand-shift family:
- #11669 (WGSL `GetDimensions`) — fixed by #11816 (`$q` marker), merged 08-18, v2026.16. Terminal.
- #13737 (HLSL `Load`/`GetDimensions`) — external dup filed 10-17, closed COMPLETED 10-18;
  fix = draft PR **#13741** @`fb36938e7` (R4 APPROVE 10-29, `Fixes #13737/#10522/#14298`),
  still draft as of the 11-07 re-check. Chain: [[13737-hlsl-combined-sampler-texture-only-ops.md]].
- #14298 (Metal dup) — triager-verified fixed at fb36938e7 11-04; `Fixes #14298` added to the PR body.
  Precedent dispatch: [[14298-metal-combined-sampler-load-subscript-arg-index.md]].

#14466 is the expected steady drip of external reports on **release binaries** while #13741
sits unmerged.

## Log
- 11-16 — dispatched slang-triager on thread `gh-issue-shader-slang/slang-14466`:
  dup-and-point (reproduce on master, verify fixed at #13741 head fb36938e7, no new fixer chain).
  **GitHub auth outage (11-16, already on the operator dashboard — do not re-alert):** gateway
  returns 401 Bad credentials for GitHub REST; comment/labels parked behind a gated retry;
  check assignees before any post (maintainer self-assign = rung-4 hold). Open item after triage:
  the #13741 owner adds `Fixes #14466` to the PR body.
- 11-16 08:59Z — triager [Report]: **confirmed dup, no new fixer chain.** Reproduced on master
  `cdca151fb` (sampler injected as operand 1 in both calls, exactly the report); reporter's exact
  repro **fixed at #13741 head fb36938e7** (rebuilt in its wt-14466-pr13741; both calls emit clean;
  no Linux DXC so downstream compile not run — same evidence standard as #14298). Workaround
  verified on master: `tex.__getTexture().GetDimensions(...)` / `.Load(...)`. GitHub writes
  (comment + `reproduced` + Type=Bug) parked on its gated one-shot **t-f0ef68** (13:30Z; probes auth,
  re-checks assignees first). Its evidence: its scratch-14466; its record in ITS tree memory/issues/14466.md.
- 11-16 09:00Z — Main pinned-woke #13741 owner `sess-1792252474641-muhgh6` (seq 68, delivery
  verified; pin + thread gh-issue-…-13737 + in_reply_to=2): add `Fixes #14466` to the PR body only,
  no push (protect falcor-ci run 40897173994), park behind a gated retry if 401. Mirrors the
  11-04 `Fixes #14298` handoff (its seq 66/67).
- Open: (1) t-f0ef68 — triager's parked #14466 comment/labels after auth restore; (2) fixer's
  `Fixes #14466` body edit. Resume on their reports or webhooks; no timer from Main.
- 11-16 09:04Z — #13741 owner [Report] (its seq 75): body PATCH 401'd; parked with its own
  scheduled retry (not spun); live body fetched anonymously, insertion prep verified.
- 11-16 09:26Z — triager [Report]: **auth restored, but HOLD triggered — #14466 is now assigned
  to jkwak-work** (the #13741 R4 approver). Nothing posted; t-f0ef68 cancelled. Verification
  stands (broken on master cdca151fb, fixed at fb36938e7). New fact: reporter added a follow-up
  comment with Metal/WGSL `Load` variants + own patch analysis (same root cause as #13741) —
  strengthens dup. Issue state: Type=Bug already set, 1 comment (reporter's), `Fixes #14466`
  still absent from the PR body (fixer retry pending).
- 11-16 09:28Z — triager [Resolution]: closed its side per (a)+(c) — silent, no labels, no
  timers; staged draft + evidence parked in its scratch-14466/; its record closed with resume
  triggers (@nv-slang-bot mention / jkwak-work asks / wt cleanup on #13741 merge).
- 11-16 09:30Z — Main live check (anonymous read works again): PR #13741 OPEN, body still
  `Fixes #13737/#10522/#14298` — the fixer's `Fixes #14466` retry has NOT landed yet. Sole open
  item on this chain, owned by the #13741 fixer session (its own scheduled retry); walked by
  supervise-issues / #13741 chain re-checks. Resume triggers for the triager side: @mention or
  maintainer ask.
- 11-16 09:3xZ — **Main decision (triager asked a/b/c): (a)+(c).** Stay silent on the issue —
  rung-4 hold (jkwak-work assigned; #14123/#14433/#14465 precedent): comment + `reproduced` stay
  parked indefinitely, resume only on an @nv-slang-bot mention or a maintainer ask. (c) proceeds:
  the `Fixes #14466` PR-body edit on OUR PR #13741 is the fixer's gated retry (in flight since
  09:04); the merge-time auto-close is standard linkage, not an issue post. Not (b) — no bot
  comment on an assigned maintainer's issue; reporter is unblocked (own patch analysis) and the
  assignee knows the family. Triager chain closed pending a resume trigger.
