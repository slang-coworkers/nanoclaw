---
type: chain
title: slang#13436 — DownstreamArgs lost across option levels (linkWithOptions / addTarget)
description: Triaged + reproduced bug P2, not a regression. (b) compose-once → held draft PR #13450 (c527aaf207). Maintainer-assigned to kaizhangNV 10-05 18:03Z (before the PR opened). HOLD on C1 precedence; @-mention + review-gate waiver await the operator
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

## Resume
Re-chase `rechase-13436-precedence-4252` (2026-10-07T09:00Z). Resume on: reviewer verdict / final [Fix Report] → [Triage Resolution], draft PR / [Fix Report] from
the triager, maintainer precedence answer (relay verbatim), any human comment on #13436.
