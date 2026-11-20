---
type: chain
title: slang#14248 — GLSL `inverse(matrix)` exists only for GLSL/SPIR-V; HLSL and other targets fail with E36107
description: RESOLVED-PENDING-REVIEW 11-18: maintainer-filed enhancement fixed in draft PR #14536 (final head 972f56813 after a 09:21Z correction — master merge incl. #14573 exit-code change + static-assert test converted to exit-code=2 convention; earlier "refuted" exit-code claim was wrong, reviewer was right); declined findings listed for maintainer jkwak-work; issue comment patched to point at the PR; chain closed both sides; reopens on maintainer comment / review-verdict change / CI failure (webhooks -> fixer session). Ready-flip -> operator weekly list once approved.
tags: [glsl-module, matrix, inverse, hlsl, capability-gate, active-chain]
---

# slang#14248 — GLSL `inverse` on non-GLSL targets

**11-03 18:44:19Z, `issue_opened`.** Live read (11-03): OPEN, author **jkwak-work**, assigned to jkwak-work by
jkwak-work 1 s after filing (timeline `assigned` 18:44:20Z), 0 labels, 0 comments, no PR.

**Ask.** `inverse(matrix<T,N,N>)` in `source/slang/glsl.meta.slang` is `[require(glsl, GLSL_400)] [require(spirv)]`
only, so `-lang glsl` source that calls it fails with E36107 on hlsl/cuda/cpp/metal/wgsl. The proposal: a Slang-source
default `__target_switch` arm (2x2/3x3/4x4 via determinant + adjugate), then widen the `[require]` list; HLSL first,
then CUDA/CPP/Metal/WGSL/LLVM. Then remove the `TARGET_HLSL` guard in `tests/glsl-intrinsic/intrinsic-basic-scalar.slang`.

**I checked on origin/master 7f4efc7ce:** the gate is at `glsl.meta.slang:891-894`, as described. The test on master
has no `TARGET_HLSL` macro and no HLSL line yet. jkwak-work has no open PR that adds one, so the HLSL line is
most likely their own in-progress local work (same pattern as #14247, found while fixing `gh-4700.slang`).

**Duplicates/related:** none open. Title search "inverse" finds only autodiff "inverse-direction" items (#11551, #11558).
The [#14020 RFC](14020-dense-linalg-module-rfc.md) triager noted the same fact (`inverse` only GLSL/SPIR-V, no
derivative). [#13355](13350-glsl-matrix-mul-wgsl-metal-gate.md) (62 builtins gated without metal/wgsl, held on
jkwak-work) does not list `inverse`; that gate also excludes hlsl, so it is a different set.

**Disposition: held, nothing dispatched or posted.** Same class as
[#14215](14215-validate-with-downstream-compiler.md) (same author, same day): a maintainer filed and self-assigned
work with their own proposal and asked the bot for nothing. The stand-down comes from the self-assignment, not
from an R6 hold.

**Precedent conflict (flagged to the operator 11-03):** #14247 (jkwak-work, 18:35Z) was also self-assigned 1 s
after filing, but it went to slang-triager. Its record does not mention the assignment. jkwak-work now
self-assigns at filing, so self-assignment alone does not tell "I am fixing this" from "I track this".
**(Superseded 11-17, R6 operator correction: self-assignment is NOT a stand-down — hence this issue's dispatch.
The 11-03 hold was retired, not re-armed.)**

**Resume** only on a comment that @-mentions @nv-slang-bot, or an operator ask. Mentions arrive as webhooks,
so there is no re-check timer.

**11-17: dispatched (R6).** Triager on the canonical thread `gh-issue-shader-slang/slang-14248` — repro verified on
`da04f042` (E36107 on hlsl/wgsl/metal, spirv clean), labels `reproduced` + `regression`, Issue Type Bug; triage
5-bullet = the issue's only comment (6938081937, later PATCHed). Fixer started `fix/issue-14248`
(glsl.meta.slang + 2 test files) but the slang-fixer group hit a fleet-wide "couldn't answer" infra wave and errored
3× (04:36Z retried; ~05:21Z double-failure escalated to the operator; third failure left the chain unowned).
Fallback was armed: the issue comment was patched so a maintainer could implement directly from the brief.
**07:20Z re-check (t-e66629):** fixer healthy again, chain unowned → per plan the triager re-sent the
[Triage handoff] brief ONCE (07:23Z). **Current state (11:01Z): round-1 REQUEST_CHANGES fully addressed at PR #14536 head b671fd850** (explanation comment
refreshed, CI run 44065030375 pending). The round-1 bug was real: same-target [require] buckets merge rather than
relax, so GLSL_400's spirv_1_3 arm had silently upgraded pinned spirv_1_0 compiles to SPIR-V 1.3 modules — fixed
via a new additive capdef alias `cpp_cuda_glsl_hlsl_metal_llvm` (pinned compile now emits a 1.0 module, verified);
plus comment fixes (m[row][col] convention), HLSL-leg 1x1 test, E41012 warning guards, -vk L40S validation vs
native MatrixInverse, -wgpu CI leg, static-assert diagnostic test. tests/glsl-intrinsic/ 260/260.
**Round-2 [Fix Review Request] re-dispatch to slang-reviewer is parked on a codex-bridge 429 outage — 9 failed
attempts, ~75+ min as of 11:34Z, backoffs to 12 min.** Fixer correctly refuses to bypass the critique gate.
Disposition sent to the fixer (msg 27, 11:3xZ): no operator waiver yet (draft PR, no urgency override; organic
retry turns inbound — CI webhook 44065030375 routes to the pr-mapped fixer session). Backstop: one-shot re-check
task 14248-round2-recheck-30c8 at 12:15Z (resolved → record only; still parked → one pinned nudge to the fixer
session; still 429ing → reschedule once ~75 min out). **11-18 09:21Z: CORRECTION landed (round-2 reopen) — final head 972f56813.** The fixer's earlier "refuted
empirically" claim on the round-2 exit-code 🔴 was wrong: master had advanced 12 commits past its merge-base,
including #14573 (positive slangc exit codes + harness range check rejecting exit-code=-1), and CI builds the
merge with current master. Fixed by merging origin/master (e063f4e61) + converting the static-assert test to the
post-#14573 corpus convention `TEST:SIMPLE(filecheck=CHECK,exit-code=2)` (precedent
tests/autodiff/no-diff-carry-readnone-derivative.slang:15) + corrected 1x1 guard comment (E39999 gate fires on
every non-HLSL target post-merge, so the HLSL-only guard stands). All tests re-verified green (262/262, all 7
targets, pinned spirv_1_0 → 1.0 module through the merge); all three critique stages re-approved at this head;
PR #14536 now 14 commits, MERGEABLE; CI 44272850909 queued (verified waiting). Two-round limit remains reached.
Issue comment 6938081937 left as-is: its substance (fixed pending review + declined-findings list) is accurate
and it never carried the refuted-exit-code claim; its head/CI-run refs (f163d2051/44259701640) are cosmetically
stale but the PR description + current head-explanation comment (issuecomment-6943712638) are the live record.

**Chain state: RESOLVED-PENDING-REVIEW at head 972f56813.** [Triage Resolution] compiled by the triager and the
issue comment PATCHed to point at PR #14536 (final verdict + declined-findings list for the maintainer); chain
closed on both sides (fixer + triager) at 08:57Z, then re-corrected 09:21Z. Remaining human step: maintainer
review of draft PR #14536 (jkwak-work is shepherd and issue author) — declined findings (GLSL_400 floor policy,
4x4 formula restructure, doc-comment question) await their judgment; CI 44272850909 queued. Once approved → mark
ready-for-review so `Fixes #14248` takes over (ready-flip goes on the operator's weekly list — no per-PR ask).
Reopen triggers: maintainer comment, PR review-verdict change, or CI failure — webhooks route via the pr-mapping
to the fixer session; the triager reopens on those events.

**13:45Z FINAL re-check (14248-round2-recheck-fin-d735) fired: case (2) — one pinned nudge sent, no reschedule.**
Read of the fixer session (sess-1794888793023-ls1nbd, 13:45Z): newest row is 32 (12:08, instructions-restart notice, no
fixer action). No outbound round-2 [Fix Review Request], no reviewer activity, and the fixer's last bridge word is
still the 11:34Z 9×429 report — **no fresh 429 after 12:28Z**, so the bridge has likely recovered but the fixer never
got a retry turn (CI 44065030375 still 'waiting' upstream → organic webhook retry never arrived; the 12:08 restart
notice drew no action). Per the table that is case (2), not (3): one nudge sent 13:46Z to slang-fixer pinned
(target_session_id sess-1794888793023-ls1nbd, thread gh-issue-shader-slang/slang-14248, in_reply_to=this re-check's
inbound row) — retry the three critique stages and dispatch round-2 now; if a FRESH 429 hits, report once and stop
(threshold crossed → I take the gate-waiver decision to the operator). Delivery verified in-session (fixer row 34,
13:46Z). **This one-shot is final: no further re-check armed.** Next events on this chain: the fixer's round-2
dispatch report (or fresh-429 report → operator gate-waiver decision), or the CI webhook when run 44065030375
finally executes.

**12:28Z re-check (14248-round2-recheck-30c8) fired: case (3) — no nudge, rescheduled once.** No round-2 dispatch
after 11:01Z; fixer's last word (11:34Z) is the 9×429/~75-min report itself, so the outage is not merely "parked
at 11:01Z" but confirmed persistent, and CI run 44065030375 is still `waiting` upstream (10:27Z) so the organic
webhook retry turn never reached the fixer. Per the decision table that is case (3), not case (2): no nudge (it
would only burn another failed fixer turn against a confirmed-429ing bridge), no operator alert (#13837 dedupe).
**Final one-shot 14248-round2-recheck-fin-d735 armed for 13:45Z** — deliberately just past the 13:30Z escalation
threshold: at fire time, dispatch landed → record only; no dispatch + no fresh 429 → one pinned nudge (bridge
likely recovered, fixer needs a turn); fresh 429 → the >3h threshold is crossed → take the gate-waiver decision
to the operator (orchestrator-dashboard). This one-shot does NOT reschedule again.
