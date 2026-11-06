---
type: chain
title: slang#14112 — modf (float, out int) overload
description: tangent-vector feature request for an HLSL-compatible modf(float, out int) overload; reporter fixing it in their own PR #14353
resource: raw/triage-14112.md
---

# slang#14112 — `modf` on (float, int)

- Filed 2026-10-30 23:34:13Z by tangent-vector (Theresa Foley), self-assigned, no labels, 0 comments.
- Ask: add `modf(float, out int)` (HLSL-style) next to the existing `(float, out float)`, lowered correctly
  for every target. The reporter rejects implicit conversion for `out`/`inout` args as the alternative, and
  warns that semantics must match HLSL `modf` exactly on targets whose similar ops differ subtly.
- No prior chain; the GitHub search found no duplicate (only #10750 and #3305, which are unrelated).

## State

- 10-30 23:3xZ: dispatched to slang-triager on `gh-issue-shader-slang/slang-14112`.
  **R6 hold: no bot comment, PR or push naming the issue before 11-03 23:34:13Z** (no `bot-ok`, no crash).
  Self-assigned, so the chain is parked on the reporter: no fixer without the reporter's go-ahead.
- 10-30 23:47Z: triager reported (memo [raw/triage-14112.md](raw/triage-14112.md)). These are the triager's findings; I have not verified them myself:
  feature/low/P2, frontend + core module. Reproduced at 5a2dc5f21: E39999 on 7 targets. DXC has no int
  overload, but its general out-arg copy-out conversion accepts the call (Round_z + fptosi). The current
  float `modf` gives HLSL semantics on vk/cuda/cpu (L40S). Recommended **A**: `modf(T, out int)` overloads in
  hlsl.meta.slang that wrap the float one, shaped like `frexp(T, out int)`. B (general out-arg numeric
  conversion) is a separate design question.
  Labels `reproduced` + Type=Feature were set with 0 comments, which matches R6 precedent (#14056/#14057).
  **PARKED on tangent-vector**; triager one-shot `t-b0c226` 11-03 23:40Z posts the 5-bullet and asks for direction.
- 11-03 23:42Z: re-check `t-b0c226` done. Triager posted the 5-bullet
  ([comment](https://github.com/shader-slang/slang/issues/14112#issuecomment-6618360167); I verified it exists,
  bot-authored, no @-mention). Nothing had changed since 10-30. Re-reproduced at e73d26897: E39999 on 7 targets,
  in `.slang` and `-lang hlsl`. **Still PARKED on tangent-vector.** If they want a bot PR for A, the triager hands
  off to slang-fixer; if they fix it themselves, the triager sends a [Resolution]. No timer is set: the
  supervise-issues register (`awaiting_human`) walks it. (The R6 hold above is retired; see Core Memory.)
- 11-05 17:38Z: **tangent-vector opened their own PR [#14353](https://github.com/shader-slang/slang/pull/14353)**
  (same-repo branch `codex/modf-integer-output`, "Fixes #14112"). It uses Approach A (core `modf(T, out int)`
  overloads that wrap the float one) and adds an opt-in numerics capability `IFloatingPointWithIntegerPart`.
  The reporter owns the fix, so **no bot PR, no fixer dispatch**. The triager's [Resolution] waits for the
  issue-close webhook. 11-05 ~19:4xZ approver webhook (head 9dc98d85, CI 59/59 pass): not forwarded because
  slang-pr-approver is paused; queued in `data/approver-pause-queue.md`.
