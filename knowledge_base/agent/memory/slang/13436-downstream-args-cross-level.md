---
type: chain
title: slang#13436 — DownstreamArgs lost across option levels (linkWithOptions / addTarget)
description: Triaged + reproduced bug P2, not a regression. (b) compose-once → held draft PR #13450 (c527aaf207). Maintainer-assigned to kaizhangNV 10-05 18:03Z (before the PR opened). HOLD on C1 precedence; 3 operator decisions pending (2nd ask 10-07)
tags: [slang, cuda, nvrtc, compiler-options]
---

# slang#13436 — linkWithOptions drops session NVRTC arguments

Reporter tdavidovicNV (MEMBER), unassigned; surfaced from slangpy#1199 review (r4181761591, PR by skallweitNV).
Session `nvrtc --gpu-architecture=compute_86` + link `nvrtc --fmad=false` → `.target sm_80`.

## Triage (slang-triager, msgs 4/6, 2026-10-05 ~09:23Z)
- Reproduced at master 6ba151dcf, NVRTC 12.6 Linux; not a regression (v2025.4 / 2025.23.2 / 2026.5 same).
- Root cause (triager's finding, source cites in the memo): multi-value `CompilerOptionSet::add`
  (slang-compiler-options.h:140-173) keys DownstreamArgs on `stringValue` = tool name, so
  `overrideWith` overwrites the lower level's list and `inheritFrom` drops the incoming one. Also hits
  session→target in `Linkage::addTarget` (no linkWithOptions needed).
- This is exactly the "Related issue, out of scope" in merged #12900 (I checked the PR body myself).
- GitHub verified by me: triage comment 5991664606 (nv-slang-bot, 4148 chars), labels cuda+reproduced, Type=Bug.

## Decision (mine)
- 10-05 ~09:26Z: **GO on Approach A, through the triager** (precedent #13409/#13423: no assignee, no
  maintainer routing yet). Scope: concatenate DownstreamArgs inside the merge primitives in
  compiler-options.h (not at call sites), lower level first whatever the call order, exact (tool, args)
  duplicate elision, static unit test beside unit-test-downstream-args.cpp, plus an NVRTC-gated
  end-to-end test if feasible. **Draft PR, held.**
- 10-05 09:27Z triager update (msg 12), accepted: a fix in `overrideWith`/`inheritFrom` reaches **all 14**
  call sites (the prototype touched 2). slangc `-Xnvrtc` sits in `linkage->m_optionSet` (slang-options.cpp:2851)
  and gets re-inherited 3+ times, so exact-dup elision is load-bearing for slangc too. GO scope therefore adds:
  audit all 14 sites (incl. linkable-impls.cpp:358), a slangc `-Xnvrtc` regression check, and a PR note that
  elision works per entry, not per argument.
- Conflict precedence (session arch86 + link arch90: today link-wins, after A an NVRTC "defined more than
  once" error) is a behavior change → stated in the PR body as an explicit maintainer design question;
  no per-tool flag parsing in this PR. Approach C rejected (order depends on call sequence).
- Side finding (link() returns the same object for a requirement-free composite, so linkWithOptions
  mutates the caller's composite; cached TargetProgram ignores later link options): **held, not filed,
  not in the PR.** Operator's call.

- 10-05 13:49Z triager msg 14: ⛔ **exact-dup elision is wrong.** The session set is copied into target/module
  (target.cpp:32, module.cpp:27) and then re-merged (session.cpp:188 + slangc sites), so a level's list arrives
  twice. Elision then also eats legit per-token repeats. SlangPy adds ONE entry per token (shader.cpp:382-386,
  1634-1638; I verified this on GitHub), so `-D FOO=1 -D BAR=2` → "unrecognized option BAR=2". Local branch
  `fix/issue-13436` (90e0c36e9 tests, 14c91690e wip), nothing pushed.
- 10-05 ~13:55Z: **REVISED GO → (b) compose once.** Each level stores only its own DownstreamArgs; one
  concatenation at the consumption point; no dedup. Scope widened past "merge primitives only". Rejected: (a)
  run-level heuristic (known misses + 3-level repeats), (b′) per-entry origin tag (a second hidden
  representation on every option value), (c) shipping the regression. Plan first (sites + single concat
  point), triager reviews it, then implement. If (b) is infeasible, STOP and report; don't fall back on your own.
  Triager to correct cmt 5991664606 in place (OUTPUT_REVIEW applies).
- 10-05 13:57Z triager msg 20: brief relayed to the fixer (plan-only first deliverable). Cmt 5991664606 corrected
  in place; I verified it on GitHub (updated 13:56:45Z, 4072 chars, sole comment; Next-action = compose once, elision
  withdrawn with the BAR=2 reason, Blocker has the fmad example). Next: the triager reviews the fixer's plan against
  its own site map, then GO/STOP to me before implementation.
- 10-05 16:00Z triager msg 22: fixer's Rev 2 plan passed codex PLAN_REVIEW (r2) + triager → **implementing**. Shape:
  each level keeps its own args, joined once at TargetProgram build (session ++ target ++ link, no dedup);
  `.slang-module` digests unchanged; no public API/ABI change. Known behavior changes for the PR body: (1) old
  record-replay streams of `parseCommandLineArguments` with `-X…` replay the recorded SessionDesc (I verified
  proxy-global-session.h:457-475 records `*outSessionDesc` and only calls through when writing) → re-record;
  (2) `getSessionDescDigest` changes for sessions with downstream args → SlangPy's cache dir id (I verified
  shader.cpp:534-540) misses once after the upgrade; (3) SlangPy probably loses its OptiX `-I` today whenever link
  args are set (triager derived this from code; NOT run). **My call: accept, not a STOP**, documented in the PR.

- 10-06 01:21Z triager msg 24: **held draft PR #13450** (`fix/issue-13436`). I verified it live: draft,
  head ed81b8f196, nv-slang-bot, `pr: non-breaking`, 13 files +637/−25, body has `Fixes #13436` + precedence +
  re-record notes; issue cmt 5991664606 edited (01:20:34Z, 3142 chars, cites 13450). Codex CODE_REVIEW r3 left
  C1 = conflict precedence as the merge blocker (it's the maintainer question). The triager reports tests:
  targeted 18/18, static 45/45, full suite 7452/7453 (gfx-smoke fails on the baseline too).
  ⚠️ CI run 37398367468 "success" is NOT a real green: it took 20 s, and `gh pr checks` shows 4 pass / 57 skipping
  (draft-gated). The real matrix hasn't run. The fixer → slang-reviewer [Fix Review Request] is in flight.

- 10-06 01:36Z triager msg 28: head c527aaf207. Codex OUTPUT_REVIEW on the [Fix Review Request] spent 3 rounds,
  C1 is still must-fix, so the delivery gate refuses the reviewer dispatch. Fixer is on HOLD with no bypass (correct).
  **New fact (I verified it via the timeline):** jhelferty-nv labeled `RTR` and **assigned kaizhangNV at 2026-10-05T18:03:56Z**,
  which is after our GO (09:26/13:55) and the plan approval (16:00) but **before the PR opened (10-06 01:16Z)**.
  Precedent #13420 (maintainer assigns → bot stands down). The draft stays open as a resumable artifact.
  No reviews on the PR; comments are only coderabbit/github-actions/nv-slang-bot.
- 10-06 ~01:40Z **my decision:** no gate waiver (I don't waive critique gates; peer review is moot if the
  assignee takes over), no @-mention without operator OK (outward). Freeze all further bot work on #13450.
  Asked the operator: (1) OK to post one short note on #13436 to kaizhangNV (bot draft exists + C1 options +
  "take it or close it"), (2) hold vs. close the draft. Side-finding question still pending.

- 10-07 09:03Z re-chase (`rechase-13436-precedence-4252`): **no operator reply, no human GitHub activity.** I read the dashboard
  (bounded read, 200 rows back to 10-06 00:55Z) and found nothing after my 10-06 01:38Z ask. #13436 is still assigned to kaizhangNV and
  its only comment is 5991664606. #13450 is a draft at c527aaf207, BEHIND master, 5 pass / 57 skipping, 0 reviews, and only bot comments.
  PR-board sync auto-assigned kaizhangNV as shepherd and requested their review at 10-06 01:17Z; its notice says jkwak-work has stronger
  committer signal. The 10-06 12:13Z body trim (996 chars, operator-approved PR-description rule) left the code unchanged. Nothing went to
  the triager. **2nd ask** sent to the operator via send_message (dashboard msg id 25, thread gh-issue-shader-slang/slang-13436).

- 10-07 18:27Z **kaizhangNV (MEMBER, assignee) cmt 6044229850 on #13450, @nv-slang-bot** (I verified it live): keep append
  session → target → link, no per-flag override/dedup, policy RESOLVED (PR body must stop calling it a blocker). Docs contract:
  stringValue0 = tool, stringValue1 = args one per line; order; `--fmad` example (all 3 args forwarded); conflicts are
  tool/version-dependent (NVRTC 13.0.88 warns and uses false; 12.6 rejects), no universal promise; compatibility note. CLI: run
  `-Xnvrtc --fmad=true -Xnvrtc --fmad=false`, `-Xnvrtc --fmad=true --fmad=false -X` (do NOT silently correct it) and
  `-Xnvrtc... --fmad=true --fmad=false -X.` exactly as written; report invocation/versions/exit/diagnostics/args reaching NVRTC +
  observable-FMA PTX; separate parse failures from downstream ones; CLI spellings documented separately.
- 10-07 18:37Z triager msg 32: freeze lifted, fixer proceeding (docs + tests + CLI runs + PR body refresh → slang-reviewer), still a draft.
  **I accepted.** Operator questions (1) note to kaizhangNV and (2) hold/close are now MOOT (the assignee engaged and wants the PR
  updated). (3) side finding is still open. Additions I sent: the requested CLI report goes on the PR as a reply to 6044229850; tested NVRTC
  versions must be stated (local is 12.6, so don't claim 13.x behavior); PR is BEHIND master, rebase OK.

- 10-07 18:38:04Z **kaizhangNV marked #13450 ready for review** and requested their own review at 18:38:05Z (I verified the timeline
  myself). That overrides my "stays draft" condition, and it was the maintainer's own action, so I accepted it and don't flip it back.
  CI now runs for real on each push. mergeStateStatus BEHIND, head c527aaf207. Both PR approvers are paused (`ncl groups list`
  paused=1), so any pr_ready_for_review webhook is NOT forwarded. Triager msg 46: after the [Fix Report] it does one final
  edit of cmt 5991664606, then [Triage Resolution], then stops posting on the issue.

- 10-08 04:24Z **[Triage Resolution]** (triager msg 52). I verified it live: head 03de207e8c (master d074e7779e merged in, no force),
  MERGEABLE / BLOCKED, reviewDecision empty. Reviews: kaizhangNV COMMENTED 10-07 20:54Z (inline thread addressed in a6596fb, left
  for them to resolve) + bot COMMENTED. CLI report = PR cmt 6045647570 (bot, 4080 chars). Issue cmt 5991664606 got its final edit
  (04:24:30Z, 3658 chars, no draft/precedence-pending wording). Internal slang-reviewer R2 APPROVE (0 bugs) per the triager.
  CI run 37724999088 `waiting` (falcor gate), checks 38 pass / 17 pending / 2 skipping / 0 fail. The triager has stopped
  posting on the issue and sends FINAL on merge only.
  Operator [Resolution] sent (dashboard id 63) + a correction (id 65), after a post-hoc codex OUTPUT_REVIEW: BLOCKED = approval
  AND CI; the falcor gate is a `falcor-ci` pending deployment needing `ci-approvers` **approval** (not a rerun); session → target
  → link is the order Slang COMBINES the lists, and the final NVRTC order can differ (`-I` → include path is emitted first; a6596fb).

## Resume
Re-chase `rechase-13436-precedence-10ab` (2026-10-09T09:00Z): CI completion (the falcor gate may need a maintainer rerun,
cf. #13391), kaizhangNV approval/merge, any new human comment (relay verbatim to the triager). Side finding (3) is the only
operator question left.
