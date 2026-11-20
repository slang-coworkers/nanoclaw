---
type: chain
title: slang#14589 — glslang rejects `sin` of a double with -emit-spirv-via-glsl (GLSL facet of the #14061 double-transcendental cluster)
description: Human-filed (jkwak-work, self-assigned — also #14061's assignee) 2026-11-18. Triager reproduced on ToT 4a1d62c5b; via-GLSL path rejected by glslang, direct SPIR-V path only appears to work via constant-folding (non-constant emits invalid OpExtInst %double Sin — #14061's finding). HELD maintainer-driving: no fixer, no ping, no timer. Containment episode 11-18 closed: unauthorized fixer turn produced draft PR #14600 (approach A @ 6ac1c3264), closed 16:53Z, branch preserved; terminal per final cover 17:20Z.
tags: [glsl, spirv, emit-spirv-via-glsl, fp64, glsl-std-450, transcendental, r6]
---

# slang#14589 — `-emit-spirv-via-glsl` + double transcendental → glslang rejects

**Ask.** `sin` on a `double` with `-target spirv -emit-spirv-via-glsl` emits GLSL `sin(3.0LF)`;
GLSL has no `sin(double)` (glslang's double-builtin block, Initialize.cpp:741, omits trig overloads even with
`GL_ARB_gpu_shader_fp64`), so glslang rejects. `tests/compute/transcendental-double.slang` excludes the `glsl`
target with a comment naming this; its vk variant is DISABLED_TEST ("values are incorrect on vulkan").

**Routing (11-18 15:06Z).** `issue_opened` webhook; author jkwak-work, no labels, self-assigned (NOT a stand-down
per R6, but decisive for owner detection — see disposition). Eyes reaction posted; dispatched to slang-triager on
`gh-issue-shader-slang/slang-14589` (msg id 3).

**Triage (slang-triager, 11-18 ~15:15Z, fresh build, ToT 4a1d62c5b, `slangc -v` 2026.13.1-50-g3649fb982).**
- Reproduced verbatim: via-GLSL exits 2 with `glslang: 'sin' : no matching overloaded function found`.
- Direct SPIR-V compiles ONLY because `sin(3.0)` constant-folds; a non-constant `sin(double)` emits
  `OpExtInst %double Sin`, which spirv-val rejects ("expected Result Type to be a 16 or 32-bit float") — i.e. the
  direct path is the **#14061** invalid-module bug, masked here by folding. pow/exp(double) identical.
- Emitted GLSL header is bare `#version 450` (no fp64 extension lines); root cause confirmed standalone via
  `external/glslang` build: double sin rejected under Vulkan AND desktop semantics. GLSL.std.450 Sin is f16/f32-only,
  so any fix must synthesize f64 math or emit a clean unsupported-type diagnostic — same A-vs-B fork as #14061.
- Prior shared learning 1793312363687 (= the #14061 triage memo) already maps the full invalid-on-double op set.
- Memo: `memory/issues/triage-14589-repro.md`; artifacts in `/tmp/repro-14589/` (not /tmp/opencode, root-owned).

**Disposition (Main, 11-18): HELD maintainer-driving — no fixer, no ping, no timer.**
#14589 is the GLSL-path facet of the [14061](14061-spirv-double-glsl450-transcendentals.md) cluster (double
transcendentals → invalid GLSL.std.450 / no f64 implementation), which has been parked on jkwak-work since 11-02
(A-vs-B is a maintainer decision). jkwak-work filed **and self-assigned** #14589 — same hold pattern as
[#14323](14323-hlsl-sm5-double-byte-address-uint64.md): the maintainer is actively driving the cluster, so a parallel
bot fixer chain would duplicate a decision already in a maintainer's hands. Filed-only; rests alongside #14061 on the
/supervise-issues parked-chain register; webhook delivers any jkwak-work comment/PR.

Triager posting authorization: concise triage comment (repro on master + the direct-path folding-masks-#14061 finding
+ same-repo cross-ref to #14061), `reproduced` label, no fix direction pushed.

**11-18 15:18Z: triager handoff crossed the hold — recalled.** The triager's [Triage] rollup (msg 8, 15:18Z) handed
off to slang-fixer despite the msg-7 hold (sent 15:16Z; the handoff crossed it mid-turn — long-turn handoffs can miss
a mid-turn parent disposition). Fixer session `sess-1795015143934-imfefp` minted on the 14589 thread 15:19Z;
stand-down delivered 15:20Z via the pin recipe (target_session_id + thread_id + in_reply_to=my webhook row seq 2),
**verified in its transcript (seq 8)** before it started work — no branch/PR state to unwind. Correction sent to the
triager (in_reply_to=8): no re-hand-off; the msg-7 posting task (triage comment + `reproduced`) still owed. Hold
unchanged: maintainer-driving, no timer; a jkwak-work comment on #14589 or #14061 resumes the chain.

**11-18 15:24Z: Type=Bug — the TRIAGER was right; my verifies were false negatives.** Issue Type ("Bug") is a GitHub
issue field, not a label — invisible in the REST labels list (and REST `issue_type` returns null). GraphQL
`issueType { name }` = "Bug" on both #14589 and #14061 (verified by Main after the triager's msg 38). My msg-37
correction was retracted in msg 39 (ack + thanks); shared learning filed (Issue Type is GraphQL-only). Triager stood
down correctly.

**11-18 15:36-15:40Z: fixer turn ran through the hold — containment set.** The fixer session (imfefp) minted 15:19Z
from the triager's crossed handoff; its turn read the inbox only at 15:19, so both stand-downs (its seq 8 mine, seq 10
triager's, 15:20Z) went unread mid-turn. At 15:36Z it reported mid-build (three commits staged in wt-slang-14589:
repro test, `__isDouble` intrinsic, glsl/spirv gates; building slangc+slang-test, ETA ~15:56Z) — NOT defiance, an
unread inbox. `ncl cost-cap stop` (15:38Z) landed as an inbound cost_override row (seq 12) — also next-turn-boundary
only. No mid-turn abort exists. Containment: (a) triager briefed (msg 65, in_reply_to=40) to close the expected draft
PR fix/issue-14589 on appearance (in-surface), keep the branch, note head sha, and not authorize anything if a
[Fix Report] arrives; (b) dashboard informed (msg 67); (c) one-shot backstop `recheck-14589-fixer-arti-1137` at
16:15Z (prompt self-contained, closes the PR itself if the triager missed it); (d) shared learning filed: stand-downs
and cost-cap stops only apply at the next turn boundary. Expected artifacts: branch fix/issue-14589 + DRAFT PR
~16:00Z, closed within minutes; the fixer session should quiesce at turn end.

**11-18 16:42-16:55Z: containment endgame — PR #14600 opened late, closed in 10 min.** The fixer's single turn ran
~95 min (15:19→16:51): both guard tasks (triager's t-63167a 16:12Z, my recheck-14589-fixer-arti-1137 16:15Z) fired
pre-PR no-ops. It pushed branch `fix/issue-14589` (3 commits: 28a02028f repro test → 58a2fa131 `__isDouble` IR
intrinsic → 6ac1c3264 80 glsl/spirv gates = approach A, E41400 diagnostic) and opened draft PR
[#14600](https://github.com/shader-slang/slang/pull/14600) at 16:42:58Z ("Diagnose double transcendentals on the
glsl and spirv targets", head sha 6ac1c326478a54f0f119344ed0b5e9514ddf6ceb, upstream head repo), `pr: non-breaking`,
CI run 44350462066, board sync auto-assigned jkwak-work shepherd at 16:43Z. At turn end 16:51-16:52Z it read the
stand-downs + cost stop, acknowledged (crossing, NOT defiance), withdrew its slang-reviewer request, and reported
complete state; session then quiesced (stop applied 16:51:51Z, spent $6.89). **slang-triager closed PR #14600 at
16:53:11Z** per my msg-65 held-note comment (posted 16:53:10Z); branch preserved. Reviewer session stood down
(withdrawn/optional). Dashboard close-out sent (msg 101). Closing reports received and consistent with live state
(fixer msgs 74/80: complete-and-held, all critique stages approve, 9/9 new diagnostic test, 12372/12375 debug suite
with only pre-existing fp8-cuda failures; worktree `wt-slang-14589` + sentinel stand-down note left in the fixer
workspace; PR body carries `Fixes #14589` — dormant while closed, edit only if ever reopened to decouple;
triager msg 94: close comment [6985348776](https://github.com/shader-slang/slang/pull/14600#issuecomment-6985348776),
guard t-63167a no-op at 16:13Z was correct pre-PR, loop-closing ack sent to the fixer). No replies owed — the fixer is
quiesced and its parent already acked; a wake would only spend against a cost-stopped session. Final chain state:
HELD maintainer-driving; if a
maintainer wants approach A, the completed implementation is one reopen/cherry-pick away at 6ac1c3264; resume
triggers unchanged (explicit maintainer direction on #14589/#14061, or a reporter PR).

**11-18 16:16Z: one-shot re-check `recheck-14589-fixer-arti-1137` — nothing to unwind; containment intact.**
Checked live at 16:15–16:16Z: (1) **no PR** with head branch `fix/issue-14589` on shader-slang/slang (state=all, 0
matches — also no PR title mentioning 14589), and **no branch** `fix/issue-14589` on the repo (404) — the expected
~16:00Z draft PR never appeared; nothing for the triager to close, no head sha to record. (2) Fixer session
`sess-1795015143934-imfefp` still `active/running` its ORIGINAL 15:19Z turn (same turn, NOT new turns; last out-row
is the 15:36Z mid-build note "ETA 20 min"); the cost_override stop (seq 12, 15:38Z) remains pending at its next turn
boundary and will quiesce it. No [Fix Report] row in its transcript. (3) **No GitHub writes besides comment
6982841063** — no fixer comment on the issue. Not a failure per the decision table (no PR to close, no new turns, no
unexpected writes) → no dashboard escalation. Residual risk: the in-flight turn may still push a PR after this check —
covered by the triager's msg-65 close-on-appearance brief; if its [Fix Report] arrives, the triager does not authorize
anything (per msg 65). Chain rests unchanged: held maintainer-driving, resume triggers = explicit maintainer direction
on #14589/#14061 or a reporter PR.

**11-18 15:20Z: GitHub artifact posted (verified live by Main).** Comment
[6982841063](https://github.com/shader-slang/slang/issues/14589#issuecomment-6982841063) by nv-slang-bot: repro on ToT
4a1d62c5b, the constant-folding-masks-direct-path finding, #14061 cross-ref, and — correctly — "held for maintainer
direction (no fix chain started)". Label `reproduced` present; Issue Type "Bug" also set (GraphQL-only — see the
15:24Z note below). The triager's msg 26 ("waiting on the fixer's
[Fix Report]") crossed my 15:21Z correction; the fixer's stand-down report will reach it up its own chain — no further
action, no re-telling. Chain rests: filed-only, parked-chain register, webhook delivers any jkwak-work activity.

**11-18 17:20Z: final cover `recheck-14589-latepr-cov-4336` — CONTAINMENT COMPLETE, chain terminal (held).**
Verified live: PR #14600 on head `fix/issue-14589` is **CLOSED** (16:53:11Z, by nv-slang-bot per the triager's msg-65
brief — the exact held-maintainer-driving comment; head sha 6ac1c326478a54f0f119344ed0b5e9514ddf6ceb, branch preserved,
not deleted). Fixer session imfefp last transcript rows are the 16:52-16:54Z close-out (stand-down acks + reports +
reviewer "PR closed, nothing to clean"); no new turns since 16:54 — its `active/running` list row is the quiesced tail,
not resumed work. Decision table: no open PR to close (triager did not dead-letter), no new turns → terminal, no
dashboard row (close-out already sent msg 101, 16:55Z). Nothing owed to any peer. Chain rests: HELD maintainer-driving;
completed approach-A implementation one reopen/cherry-pick away at 6ac1c3264; resume triggers = explicit maintainer
direction on #14589/#14061, or a reporter PR.

**11-18 16:13–16:17Z: guard reports "no PR" — pre-push snapshot, NOT terminal; final cover scheduled.**
slang-triager's one-shot guard (parent msg 14, reported 16:13Z): no open or closed PR on head `fix/issue-14589`,
GitHub untouched, no re-hand-off, no continuation authorized. Verified live by Main 16:15Z (`gh pr list --state all`
for both `nv-slang-bot:fix/issue-14589` and bare `fix/issue-14589` → `[]` both). **Not a clean terminal:** fixer
sess-1795015143934-imfefp is still mid-turn (last outbound 15:36Z mid-build, seq 11; stand-downs seq 8/10 and the
cost_override stop seq 12 remain unread until its next turn boundary — no mid-turn abort exists), so the planned
mid-turn push (draft PR on `fix/issue-14589`) can still land AFTER both checks that looked for it (triager guard
16:13Z; backstop `recheck-14589-fixer-arti-1137` fired 16:15Z — its 16:16Z outcome is recorded in the section
above). Containment ladder stays: triager closes the PR on the fixer's [Fix Report] (owner, msg 65) → backstop
16:15Z (already spent on the empty snapshot) → **final cover `recheck-14589-latepr-cov-4336` at 17:20Z** (created
16:17Z, sess-1795018398926-h4zskk): closes a late open PR itself, terminal-records if the fixer quiesced with no
PR, or 5-bullet-escalates to orchestrator-dashboard if the fixer is still running new turns. No reply owed to the
triager (report complete, no action authorized); no dashboard row yet (within containment tolerance — the 17:20Z
check escalates on real failure).
