---
type: project
name: project_13633_bitcast_descriptorhandle_wgsl_bindless_emit
description: "[PARKED 11-06: draft #13679 unreviewed 3 wks; reporter asks to make bit_cast INTO a handle legal = maintainer scope call; re-check 11-13] slang#13633 (albertrodriguezclo, external, 10-15 13:15Z): bit_cast<DescriptorHandle<T>>(uint2) ICEs E99997 on all 7 targets, and WGSL prints every DescriptorHandle<T> as T (isResourceTypeBindless hard-wired true). Triaged 13:46Z, handed to slang-fixer: Fix 1 (WGSL emitter uses the layout predicate) + Fix 2-B (a located diagnostic, no new legal cast). Sibling #13641 keeps the resource-table feature."
metadata:
  node_type: memory
  type: project
---

# slang#13633: bit_cast into DescriptorHandle ICEs; WGSL emits handles as resources

**Issue.** Filed by albertrodriguezclo (external), 2026-10-15 13:15:37Z, unassigned. Sibling issue #13641 from the same
reporter came 11 s later (WGSL `chromium_experimental_resource_table` lowering).

**Triage (slang-triager `sess-1792070223292-d21hbq`, 13:46Z; memo at /workspace/inbox/a2a-1792071966357-k6y527/triage-13633.md).**
Bug / medium / P2. Not a regression: the code dates to 5290c5806 (the initial DescriptorHandle commit). Reproduced on master
6597ec920 and v2026.19. The three code sites below were verified at origin/master 6597ec9202 by the Orchestrator:
- `slang-emit-wgsl.h:14`: `isResourceTypeBindless` returns `true` unconditionally, while
  `areResourceTypesBindlessOnTarget` (slang-type-layout.cpp:3549) = CPU|CUDA|Metal only. So WGSL prints
  `DescriptorHandle<T>` as `T` everywhere (signatures, struct fields, uniforms).
- `slang-ir-lower-bit-cast.cpp` `readObject` has no DescriptorHandle leaf → `SLANG_UNEXPECTED` default arm (~:230).
- Extra: cuda/cpp `reinterpret<DescriptorHandle>` + any unrelated user bit_cast → the same E99997 (AnyValue marshalling
  emits bitCasts after the pass gate). HLSL E99999 on `bit_cast<uint2>(handle)` was noted in the memo only and not filed.

**Disposition.** Fix 1 (WGSL emitter → layout predicate) + Fix 2-B (located diagnostic pointing to
`DescriptorHandle<T>(uint2)`; must not fire on compiler-generated AnyValue casts). Option A (make the cast legal) was
rejected because it goes against the #13480 scope signal (tangent-vector cmt 6086339080; jhelferty-nv cmt 6174071727 "Tess prefers narrow").
The triager handed it to slang-fixer, `sess-1792071976607-vgdo6h` on `gh-issue-shader-slang/slang-13633`. Drafts-only applies.
The fixer was told not to reuse E41205 and to expect a processBitCast conflict with draft #13507. Not folded into #13480
(different construct and failure site).

**Split with #13641** (agreed 13:28Z): #13633 owns the emitter fix; #13641 keeps the resource-table feature + #9528 heap,
and its comment points to #13633. Relayed to the #13641 triager `sess-1792070213940-c9g7tq` (landed its seq 4,
13:31:49Z, after two misroutes; see [pin routing](feedback_in_reply_to_beats_target_session_id_pin.md)).

**13:47Z public triage** [cmt 6193619280](https://github.com/shader-slang/slang/issues/13633#issuecomment-6193619280), with the `reproduced` label and Type=Bug (all verified live). The triager will send a [Triage Resolution] once the fixer's [Fix Report] lands. Operator was notified on orchestrator-dashboard.

**10-15 draft PR [#13679](https://github.com/shader-slang/slang/pull/13679)** (checked live): head `ac5a9a34ef`, +271/−23,
Fixes #13633, draft. Mapped to fixer `sess-1792071976607-vgdo6h`. It adds new error E41206 (bit_cast into DescriptorHandle) and removes the WGSL
`isResourceTypeBindless` hook. CI is draft-gated and hasn't run.

**Metal variant (out of scope):** the reporter's cmt 6194533354 (14:30Z) says `Texture2D.Handle` through an interface value →
AnyValue unpack emits `(texture2d<..>)(ulong...)`, invalid MSL. Triager repro'd it on master and 2026.19; cause is
any-value-marshalling.cpp:1245 → emit-metal.cpp:894. The triager replied (cmt 6200923646, 19:50Z) that it's out of scope for
#13679 and asked the reporter to file it; the bot offered to file it otherwise. **Open loop:** if the reporter doesn't file it, the
triager owns filing it.

**10-16 07:37Z:** round-2 review at head `f51b857721` came back APPROVE_WITH_NITS (slang-reviewer `sess-1792093847598-1lwc74`), and the fixer is applying the nits. Still a draft; shepherd is jkwak-work (board-sync). All 5 PR tests are `SIMPLE` compile/filecheck tests, so the GPU-passthrough outage (09-28 to 10-16) didn't affect their verification. The operator notice of 10-16 was delivered directly to the fixer, reviewer and triager sessions.

**10-16 08:50Z follow-up issue [#13695](https://github.com/shader-slang/slang/issues/13695)** (bot-filed by the fixer as the r2 nit "nested-handle limit plus a tracking issue"): aggregate-holding-handle `bit_cast` (GLSL drops the high word on the L40S, WGSL/HLSL/CUDA fail), WGSL/Metal byte-address handle loads, and Metal `as_type` handle casts. Owned: PR #13679 cross-referenced it at 08:52:06Z, so the webhook session dispatched nothing and sent no report. The #13633 Main receives it through the fixer's `[Fix Report]`.

**10-16 08:54Z [Fix Report]** (fixer to triager; copy to Main, checked live): head `e2c77882c4`, `pr: non-breaking`, still a
draft, review requested from jkwak-work (board-sync, not the fixer). CI run 38873310343 is `waiting` on the human gate. 6 tests / 40 lanes, including a
Vulkan+CUDA runtime test on the L40S. Full GPU suite at 82be82e: 10215/10218, with 3 fp8-cuda failures that also fail on master. The clarity reviewer (C) never finished r2
(it died in the restarts). Follow-up issue [#13695](https://github.com/shader-slang/slang/issues/13695), bot-filed and owned by this chain: GLSL
bit_cast of an aggregate holding a handle drops the high word (wrong result confirmed on the L40S), and BAB handle loads → Tint-invalid WGSL;
both also on master. The Metal-variant filing loop (cmt 6194533354) is still open with the triager.

**10-16 08:55Z [Triage Resolution]:** RESTING. The PR is +573/−26 across 17 files and MERGEABLE (checked live). The triager edited cmt 6200923646 in place; it
asks the reporter to file the interface/Metal variant again and offers to file it for them. **Re-check armed:** one-shot task `rechase-13633-draft-pr-dd7b`
at 2026-10-20T13:00Z (no recurrence).

**10-19 20:10Z:** the reporter filed the Metal variant as [#13753](project_13753_metal_anyvalue_texture_handle_cast.md) (cmt 6276275674). It was dispatched to slang-triager on its own thread, so the Metal-filing open loop is closed. At 21:31Z the reporter opened their own fix PR #13755 and our fixer stood down (terminal-for-now; see that record). Rechase `-dd7b` branches (2)/(3) are marked DONE. The same comment flags that #13707 drops the same `isResourceTypeBindless` hunk as #13679, so whichever lands second drops that hunk.

**10-19 20:10Z reporter cmt 6276275674:** filed the Metal variant as [#13753](https://github.com/shader-slang/slang/issues/13753) (still on
2026.20). It also says their own non-draft PR #13707 (#13641 resource-table lowering, `feature/wgsl-resource-table`) contains the same
`isResourceTypeBindless` removal as #13679, so whichever merges second drops that hunk. Routing: I took it, because the sibling Main for #13753
(`sess-1792440638292-w5ihka`) was waiting on me. #13753 went to a fresh triage (slang-triager `sess-1792441084341-wve4gx`, thread `-13753`, given the
earlier Metal findings + #13695 overlap question). The comment went verbatim to the #13633 triager (`d21hbq` seq 30). The metal-filing loop is closed.
Re-check task `rechase-13633-draft-pr-dd7b` was updated with these facts.

**10-19 20:20Z:** the triager replied on the issue (cmt 6276457769). The #13707 overlap is harmless: both PRs produced the identical
`slang-emit-wgsl.h` blob `abd726c0113` on 10-19 (verified then; stale by 11-06, see below), and it's the only shared file, so whichever lands second rebases cleanly. No note on #13679, no fixer ping.

**10-20 13:00Z re-check (`rechase-13633-draft-pr-dd7b`, branch 7):** no change. Head still `e2c77882c4`, draft, MERGEABLE/BEHIND, review still requested from jkwak-work with none submitted, CI 38873310343 still `waiting`. No human comment since cmt 6276275674. #13707 is not merged. jkwak-work self-assigned and milestoned #13695 on 10-19 16:13Z. I asked the operator on orchestrator-dashboard (thread `-13633`) whether to nudge jkwak-work. **No re-arm**; the chain is parked on that operator decision.

**10-20 re-check:** no change. The operator was asked once (dashboard msg 3) whether to nudge jkwak-work; no answer is recorded.

**11-06 22:57Z, reporter cmt 6697869518 on #13679:** asks that `bit_cast<DescriptorHandle<T>>(uint2)` on non-bindless targets lower like the
`DescriptorHandle<T>(uint2)` ctor. That is Approach A, a contract widening. Its argument is a real asymmetry: #13679 already makes bit_cast *out of* a handle work.
#13480 shows no maintainer decision; skiminki-nv cmt 6193120460 (10-15) quoted the spec and SPIR-V OpBitcast and said "I don't have an immediate opinion".
I told the fixer (msg 181, landed vgdo6h seq 48) to reply honestly about the asymmetry, defer scope to the maintainers (jkwak-work + #13480), and make no code change.
Timer: one-shot `rechase-13679-scope-6ec0` at 2026-11-13T13:00Z.

**11-06 23:19Z fixer reply** (cmt 6698283183, verified live): it acknowledges the asymmetry, quotes the #13480 maintainers verbatim, names the
`DescriptorHandle<T>(uint2)` ctor as the supported path, and puts both questions to jkwak-work (no @-mention). No code change. Build dir reclaimed, so any change needs a ~20 min rebuild.
**Corrections (the fixer caught both):**
- tangent-vector's exact words are "were not really vetted for general-purpose use out in the wild", not "never vetted for general use".
- The `slang-emit-wgsl.h` blobs are no longer identical. #13707 at `c09c746ea6` has `c7ea931f4f4`, because it merged master (`m_requiresImmediateAddressSpace`); #13679 still has `abd726c0113`. The deletion hunk is the same and `git merge-tree` is clean. My "byte-identical" was true on 10-19 and went stale.

**Next resume trigger:** the fixer's draft PR report, or a human comment on #13633.

**11-16 07:36Z [ci_failed + auth-outage park]:** a `ci_failed` webhook hit PR #13679 (head `e2c7788`, unchanged since 10-16, bot-r2-approved, still no human
review — the 04:44Z sibling re-check read the public pages to confirm). The slang-fixer could not classify it: the GitHub credential outage (401 `Bad
credentials` / OneCLI `app_not_connected`, down since ~04:41Z) kills every API read. Candidate causes: priority-yield on the aging force-run (→ do
nothing), flaky (→ `gh run rerun --failed`), or genuine merge-ref drift of a month-old head against today's master (→ merge master + fix + re-push).
**Park:** the fixer's own gated one-shot `gh-cred-recheck-13679-990d` (fixer group, fires 2026-11-16 10:36 UTC, script gate wakes only on GitHub 200;
verified active, session `39rk6l`) classifies and acts the moment auth works; if still broken it reports blocked once and stops — no polling loop. The
Orchestrator-side restore-watch `github-auth-restore-watc-42a0` must **skip #13679** — covered by the fixer's one-shot. Operator has everything: outage
alerts 04:41Z/07:07Z + the OneCLI reconnect URL (my probes return a `connect_url` the fixer's 401s lack), posted to orchestrator-dashboard 07:27Z. The
fixer's 07:36Z ask_user_question (timeout 0) timed out — operator not at the wheel; no further operator escalation owed for this chain.

**11-16 10:38Z [park discharged — one-shot fired, ci_failed = STALE]:** the fixer-group gated one-shot `gh-cred-recheck-13679-990d` (session `39rk6l`, fired 10:36Z once the GitHub gate passed) completed the parked classification, and reported up to a Main bubble on the same task thread (report received 10:39Z). Verified live from Main: credentials healthy (200s), old run 38873310343 is 404 (deleted), head `e2c7788` (unchanged since 10-16, draft, behind) had no failing run — the 07:36Z ci_failed matched no live run, so priority-yield/flaky/merge-drift all don't apply. Remediation: fixer re-dispatched ci.yml → run **43850704891** on e2c7788 (created 10:38:42Z, status `waiting`); its result arrives via webhook to the PR's mapped session — no polling. Chain now waits on (a) run 43850704891's outcome and (b) the maintainer answer to the 11-06 reporter thread. No dashboard post: 09:23Z addendum (seq 512748) already told the operator the fixer's connection writes fine, and the 07:36Z park owed no further escalation. Supervisor-state #13633 disposition refreshed (was stale at head f51b857/round-2). Memory correction: the 07:36Z note's "(fixer group …)" attribution was right — `ncl tasks get` from Main correctly returns "task not found".

**11-16 10:39Z [ci_failed closed]:** the fixer's gated one-shot `gh-cred-recheck-13679-990d` ran after the credential restore and re-classified:
**zero workflow runs and zero check runs exist on head `e2c7788`** (only `license/cla` = pass) — the `ci_failed` webhook was a stale event referencing deleted runs,
remediated, nothing owed. (Durable lesson logged by the fixer: "deleted CI runs are a fourth outcome" — a ci_failed event can name a run that no longer exists.)

**11-18 10:45Z [live inbound — reporter comment cmt 6976226585]:** albertrodriguezclo posted another way to hit the same abort: `reinterpret<DescriptorHandle<T>>(uint2)`
on `-target cpp`/`host-callable`/`cuda` aborts E99997 (`Unable to generate bit_cast code for the given type`) on master `4a1d62c5b`, triggered whenever the linked IR contains
any `BitCast` (a `countbits()` call is enough — its GLSL/SPIR-V branch brings `bit_cast<uint2>(uint64_t)` in via `__emulatedCountbits64`). Their root-cause trace:
`processBitCast` skips resource/sampler/structured-buffer types but not `IRDescriptorHandleType` → `readObject` reaches `SLANG_UNEXPECTED`. SPIR-V/HLSL/Metal compile it.
They announced they will open their own PR: lower handle bit casts on CPU+CUDA (generated and direct `bit_cast<DescriptorHandle<T>>(uint2)`) + located diagnostic elsewhere.
No such PR exists yet (checked 10:46Z). Dispatched to the chain fixer (vgdo6h, pinned, seq 64): reproduce/verify, post ONE ack on #13633 naming the overlap with draft
#13679 (same `lowerBitCast`/`processBitCast` area — if their PR lands first we rebase #13679; #13707 shared-hunk precedent), make no scope promise (consistent with the 11-06
defer-to-maintainers reply cmt 6698283183), and STAND DOWN on the variant per the 10-19 self-PR precedent (#13755). Reporter is credible — this chain's whole history validates
their reports; the 11-06 corrections show to verify their exact wording before quoting.

**11-18 11:01Z [ack posted, chain resting]:** the fixer verified the reporter's analysis empirically (fresh Debug build of master `4a1d62c5b`: E99997 on cpp/host-callable/cuda,
clean on hlsl/metal, `countbits()`-gated, `DescriptorHandle<Texture2D>` identical) and in source (skip list `slang-ir-lower-bit-cast.cpp:406-423`, `readObject` `:269`, pass gating
`slang-emit.cpp:573/2703`, countbits GLSL branch `hlsl.meta.slang:10136`), then posted the ack: cmt 6976600759 (OUTPUT_REVIEW approve, ≥1000-char attestation path). One honest
carve-out stated in the ack: SPIR-V lowering runs without the abort but no full `.spv` emit was checked (build lacks prebuilt spirv-opt/glslang) — that target taken on the
reporter's word. Stand-down posture on the fix (reporter self-PR, #13755 precedent); worktree back at `fix/issue-13633` @ `e2c7788`.
**Watch item for when the reporter's PR lands:** #13679's E41206 diagnostic already rejects the cuda/cpp reinterpret-into-handle path the reporter plans to lower — the
rebase must reconcile diagnostic-vs-lowering there, not just merge hunks. No timer needed: their PR will arrive via webhook routing.
