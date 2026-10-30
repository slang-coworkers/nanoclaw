---
type: project
name: project_14016_cuda_active_mask_ballot_sync_overhead
description: "slang#14016 (albertrodriguezclo, 10-29): CUDA active-mask over-emits __ballot_sync (4x perf) + a triage-found exit-ballot GPU deadlock. TERMINAL: draft PR #14025 @63597277a (deadlock + dead-ballot pruning) and stacked draft #14050 @a9da82b23 (entry-mask reuse), both R1 APPROVE_WITH_NITS; shepherd kaizhangNV; draft-vs-ready pending with the operator. The child tiers intermittently misroute reports to Main."
---

# slang#14016: CUDA active-mask synthesis over-emits `__ballot_sync`

**Routing (10-29).** `issue_opened` 12:40Z landed in Main `sess-1793277611457-pc09u5`. Live check
12:42Z: open, 0 comments, no assignee/labels, CONTRIBUTOR-filed report (not bot, not a maintainer
work item), body matches payload. No prior chain. Forwarded to slang-triager on
`gh-issue-shader-slang/slang-14016` (msg 11, 12:42Z); triager session `sess-1793277757506-ktr6eo`
running on the canonical thread.

**Content (reporter's claim, unverified).** `slang-ir-synthesize-active-mask.cpp`: once a wave op
sits inside a loop, the loop condition, every if/else arm, merge points, and wave-op-free inner loops
all get `__ballot_sync`; most results unused. Minimal repro: `wave_mask.slang` (4-pass outer loop,
one `WaveActiveSum`) gives 16 ballots at `-target cuda -O3`. Reporter suggests: drop dead ballots,
reuse pre-region mask at normal-exit merges, restrict synthesis to regions reaching a wave op,
optional `__activemask()` mode.

**Related (search, not a duplicate):** #12847 open — duplicate `OpGroupNonUniformBallot` on SPIR-V
(different backend/pass).

**Triage (slang-triager msg 16, 13:20Z; Main-verified live 13:22Z).** bug P2, IR (`synthesizeActiveMask`,
CUDA-only); medium (perf) / high (deadlock). Not a regression (#1352, 2020). Reproduced at 01dcd3568:
16 ballots, 3 live; L40S 7.4 ms → 0.73 ms with A1+A2 hand edit. **New finding: GPU deadlock** —
`transformChildRegion` early-return (:2032) skips arms that don't reach a mask use, so their exit
ballots are never emitted; hangs when a group barrier follows (shapes `asym2`, `brk2`). Rec A = A1
(complete exit-ballot groups; fixes deadlock) + A2 (region-grouped liveness pruning). Reporter's
"drop dead ballots" alone is unsound. Live: label `reproduced`, type Bug, bot comment 6497786865
(names the deadlock; only ref #1352, no @-mentions). Memo: `/workspace/inbox/a2a-1793280006488-uolqz1/triage-14016.md`.
slang-fixer session `sess-1793279937673-7qx06k` on the canonical thread, branch `fix/issue-14016`.

**Main decision (13:23Z): no separate tracking issue for the deadlock.** It is A1 of the same fix,
already public in the triage comment; a bot-filed issue nobody asked for adds an artifact without
adding tracking. Ask: A1 as its own commit with barrier-after-divergence CUDA regression tests and
the deadlock named in the PR title/description; split A1 into its own PR only if A2 grows large
(triager/fixer call). A maintainer asking for a separate issue overrides this.
Fixer pinged Main directly (msg 24, build ETA) — tier skip; not answered.
Triager confirmed (msg 38, 13:22Z): relayed to fixer (msg 17). Split rule: A1 ships as its own PR first if A2 grows
past a few hundred lines or needs its own review rounds; otherwise one PR, two commits. Fixer told to send all status to
the triager. Next expected: [Triage Resolution] from the triager.
Fixer pinged Main directly again (msg 40, 13:26Z, an ack after the triager redirect). Not answered; the mechanism was already named once. If it keeps happening, tell the operator, not the fixer.

**PR #14025 (draft, 16:06Z; triager [Report] msg 42 16:12Z; Main-verified live).** "CUDA: fix active-mask exit-ballot
deadlock and prune dead ballots", `fix/issue-14016` head `edc0fc95c`, +542/−15, 6 files, `pr: non-breaking`. 6 commits:
failing repros (445dad903) → dominator-tree-once (072c08493) → keep branch decorations (6aaaee0c3) → **A1 exit ballots on
every edge (5c5279e43)** → mask-value tracking (01046507a) → **A2 dead-group pruning (edc0fc95c)**. pr-mappings row →
fixer session 7qx06k. One PR (A2 +307 lines in pass, under the split threshold). The fixer reports, and I have not
re-run: 16→5 ballots, ~7.5→0.74 ms on the L40S, 1168/1168 wave/CUDA tests. CI not run (draft). Next: the fixer's review loop → [Fix Report].

**16:16Z fixer [Report] (msg 46) came to Main again, a third time and after the redirect.** Its new facts: slang-reviewer peer
review requested, CI dispatched, shepherd kaizhangNV (verified: assignee + review request), new bot issue comment
6502074762 (verified), no shared-merge test (judgment call). Diagnosis: fixer session 7qx06k sits on the triager↔fixer a2a
mg (`mg-a2a-1780672222602-epsn3s`), all its inbound is from the triager or webhooks, yet its [Report] and pings reach Main. The
triager's inbox has only the fixer's Explanation. **Actions:** relayed the facts to the triager (msg 59, in_reply_to 42),
told it to pull the [Fix Report] if it doesn't arrive; flagged the pattern to orchestrator-dashboard (msg 61). Not telling
the fixer again (budget-of-one rule). Both sends drew a `[GATE AUDIT] ... "[Fix Report]" ... codex-critique never invoked`
warning: a keyword false positive, because neither message is a fix report.
Triager acked (msg 68, 16:19Z): keeps both bot comments, will not re-tell the fixer, one-shot re-check 18:30Z. If the reviewer verdict is on #14025 and no [Fix Report] has reached it, it pulls one from the fixer and sends Main a [Triage Resolution]. Relay delivered to ktr6eo (inbound seq 12; the `--reverse` listing shows it below the newer out rows).

**17:10Z reporter comment 6503345150 (pr_mention, no @-mention; live = payload).** Second data point: in a cloth-sim SpMV
(one `WaveActiveBallot` + 5× `WaveReadLaneAt`), ternaries and `||` lower to branches with arm ballots, and the `[unroll]`
loop stays rolled. Reporter: non-blocking codegen quality (0.294 vs 0.298 ms). Forwarded verbatim to the triager (msg 73,
in_reply_to 68) with checks against #14025: (a) is `[unroll]` handled by 6aaaee0c3? (b) are arm ballots pruned by A2?
Reply and test scope are the triager's call.

**17:22Z triager [Report] msg 78 (Main-verified: comment 6503579630 nv-slang-bot 17:21Z, no links or @-mentions;
`tests/cuda/active-mask-loop-unroll.slang` is in the PR).** SpMV approximation: 22→13 ballot sites at the PR head. (a) `[unroll]`
fixed by 6aaaee0c3. (b) Ternary/`||` arm re-ballots remain, and they are live (they feed the next wave op), so A2 keeps them
correctly; removing them needs reporter suggestion 2 (reuse the entry mask at the merge of an all-normal-exit region). Decision
(triager): keep it out of #14025; the fixer will open a **stacked follow-up PR** ("Addresses #14016", spmv.slang test) after
the #14025 review verdict (fixer msg 35). The reply gives a workaround: `select()` + `|`. The 18:30Z recheck is still armed.

**17:25Z fixer msg 80 (4th misroute):** asked for `/workspace/agent/scratch-14016/spmv/spmv.slang`, "in your container, not
mine". The file is in the TRIAGER's container (absent from Main), which shows the fixer believes it is replying to its parent → a host
reply-resolution bug, not a spine choice. Relayed to the triager to `send_file` it to the fixer (msg 81, in_reply_to 78);
updated the operator (orchestrator-dashboard msg 83).
Triager sent spmv.slang to the fixer at 17:31Z (msg 86, file msg-1793295003713-fhgeqd) with the target: 13 sites at the #14025 head, and only the loop and wave-op ballots should remain. `ncl sessions messages` on ktr6eo timed out (30 s) twice around 17:30Z; it looked transient.

**17:38Z #14025 R1 review (slang-reviewer msgs 92/96; reviewer session 2a95ga, opened by the fixer): APPROVE_WITH_NITS** at
edc0fc95c. 0 bugs, 3 gaps: G1 the region-walk invariant needs `SLANG_RELEASE_ASSERT` (debug-only `SLANG_ASSERT` → silent hang in release);
G2 no GPU-free FileCheck for the `false` exit ballots; G3 the only-`else`-wave-op shape is untested and still hangs at master. Tested
remedy patch (+61/−1) sent to the fixer. Full suite 11070/11073 (fp8-cuda ×3 also fail on master); 143-file corpus 280→230
ballots, and the 6 files with more ballots gain the missing exit ballots (latent deadlocks, e.g. wave-read-lane-at.slang).
Review: /workspace/inbox/a2a-1793295502467-yici6f/combined-review.md. Not posted to GitHub. The fixer has all three
rows (seq 20/22/24). Told the triager (msg 99), since its 18:30Z recheck looks on GitHub. **Misroute widened:** the reviewer's "parent"
copy reached Main too, so every child tier's parent edge on this thread resolves to Main (hypothesis: the oldest session on the
canonical thread). Told the operator (dashboard msg 101).

**18:21Z [Fix Report] (fixer msg 100 → Main, misrouted; forwarded verbatim to the triager, msg 103, in_reply_to 86).** Fixed
at head **63597277a** (Main-verified: 9 commits, +639/−20, 7 files, draft, assignee kaizhangNV, `SLANG_RELEASE_ASSERT`
present). G1–G3 remedy + clarity nits applied, no further round. 1173/1173 targeted tests on the L40S (fixer's claim). CI on the
draft: 5 passed, 53 skipped, 1 pending, so the full CI has not run. **Draft = correct terminal state** ([[feedback_drafts_only_guardrail]]);
draft-vs-ready goes to the operator as a question in the chain report after the triager's [Triage Resolution]. Next on the fixer: the
stacked merge-mask-reuse follow-up PR.

18:47Z triager msg 102: verifying 63597277a on the L40S itself (5 ballots in the repro; brk2 hangs at master 8/8) before the [Triage Resolution]. It reports that CUDA context creation on the shared GPU sometimes hangs before launch, so it counts only hangs after the kernel launches. Main nvidia-smi 18:48Z: L40S 16% util, 15.7/46 GB used (processes not visible across containers). No clear infra fault, so the operator was not told; if pre-launch hangs keep happening (several coworkers are running hang repros at once), raise it as an infra issue.

**18:51Z [Triage Resolution] (triager msg 104): FIXED in draft PR #14025 @ 63597277a, held for maintainer review.**
Triager's own L40S check: repro 16→5 ballots, `-validate-ir` clean. asym2 and brk2 complete 8/8 at the head and time out 8/8
at master (after launch); pre-launch context hangs were discarded. SpMV still 13 sites, which the follow-up covers. The triager
skipped its step-9 re-post because the fixer's comment 6504895926 (verified, 18:21Z) shows the state. **Chain report to the operator
(dashboard msg 105, 18:52Z)** with a non-blocking question: should #14025 leave draft (the full CI hasn't run)? No flip until the
operator answers. The supervisor tick tracks the chain. Open items: the operator's draft decision, kaizhangNV's review, the fixer's
stacked follow-up PR, and the parent-edge misroute (msgs 61/83/101).

19:46Z fixer msg 106 (misrouted): follow-up implemented. spmv 13→5 sites, 1812/1812 tests, plus a release assert on the normal-exit invariant; it was about to open the stacked draft PR "on fix/issue-14016". Main 19:47Z: #14025 still 63597277a with 9 commits, no follow-up PR yet, head branch is in the upstream repo (not a fork). Asked the triager (msg 107) to confirm the follow-up uses its own branch with base fix/issue-14016, NOT commits pushed onto it (that would widen #14025).
Triager 19:48Z (msg 108): sent the fixer the branch rule (fixer msg 51). New branch e.g. `fix/issue-14016-merge-mask` cut from 63597277a, draft PR `--base fix/issue-14016`, "Addresses #14016", no push to fix/issue-14016, retarget to master after #14025 merges. The triager will check that the #14025 head has not moved once the follow-up PR shows up.

**19:52Z follow-up draft PR #14050 (triager msg 110; Main-verified).** "CUDA: reuse the entry mask at merges of regions with only normal exits", `fix/issue-14016-merge-mask` → base `fix/issue-14016`, head 79ea074a9, 2 commits, +167/−3, 3 files; pr-mappings → fixer 7qx06k. #14025 unchanged at 63597277a. Triager L40S: spmv 13→5, repro 5, asym2 and brk2 4/4 OK. Operator told (dashboard msg 113): the draft-vs-ready question covers both PRs, #14025 first.

**20:32Z #14050 R1 (slang-reviewer msgs 114/116, misrouted "parent" copy): APPROVE_WITH_NITS** at 79ea074a9. 0 bugs, 0 gaps; nits plus an optional tested SpMV runtime check (`r1-spmv-runtime.patch`). Full suite: only the fp8-cuda ×3 failures master already has. Review: /workspace/inbox/a2a-1793305958083-rzhcpj/combined-review.md. The fixer has it (seq 36/38/40). Told the triager (msg 119) because the verdict is not on GitHub.

**20:44Z [Triage Resolution] for #14050 (triager msg 120): FIXED, draft, held for the maintainer.** Head **a9da82b23** (Main-verified:
4 commits, +208/−4, 3 files, base `fix/issue-14016`); #14025 unchanged at 63597277a, 0 reviews. R1 nits plus the SpMV runtime check
applied. Triager relink at a9da82b23: spmv 13→5, repro 5, validate-ir clean. Reviewer's full suite: 11079/11082 (fp8 ×3). **The
fixer's #14050 [Fix Report] reached the triager directly (triager msg 48)**, while the reviewer's verdict still misrouted to Main,
so the misroute is intermittent. Closing table sent to the operator (dashboard msg 121). **Chain state: TERMINAL (both drafts).**
Waiting on: the operator's draft→ready decision (msgs 105/113/121) and kaizhangNV's review of #14025 then #14050. After #14025
merges, the fixer retargets #14050 to master.
