---
type: project
name: project_13823_metal_combined_sampler_handle_anyvalue_history
description: "Dated history of the slang#13823 / draft PR #13843 Metal combined-sampler AnyValue chain (10-21 18:31Z → 10-22 09:57Z): triage, reporter ownership flip-flop, #13844 opened/closed, R1/R2 peer review, #13851 spin-off, reporter M4 test report. Split from project_13823_metal_combined_sampler_handle_anyvalue on 2026-10-22; new dated entries append here."
metadata:
  node_type: memory
  type: project
---

# slang#13823 / PR #13843: dated history

Current state, cause, decisions and lessons: [[project_13823_metal_combined_sampler_handle_anyvalue]]. Entries below
keep only what the state page does not: ids, times and who said what.

**10-21 18:31:39Z `issue_opened`** (Main webhook session `sess-1792607502755-8epvx9`; live: open, 0 comments, no labels).
Origin: our bot's clarity review on #13755 (review cmt 4339120830, 16:12Z) raised the shape; the reporter confirmed it by
compiling (reply 4340207200, 18:01Z) and filed it themselves, so it is a human report with normal triage. With #13755
applied the case is a `SLANG_DIAGNOSE_UNEXPECTED` internal error. Ownership check clean (13753 sessions stopped since 10-19).

**~18:36Z** dispatched to slang-triager on `gh-issue-shader-slang/slang-13823` (msg 11): check #11540's rationale first,
do not repeat the retracted "cannot be written in MSL" claim, look for a reporter PR before any fixer handoff.

**19:20Z [Triage]** (triager msg 14; memo `/workspace/agent/reports/triage/triage-13823.md`): bug / low / P2. A (diagnostic)
dispatched; B (16 bytes) left to maintainers; C rejected. Live: issue cmt 6324433966 (19:16:26Z, asks the reporter whether
they will fix it and maintainers whether they want A), labels `reproduced` + Type=Bug; #11540 quote checked in cmt 4812768459.
"Preparing an automated fix" before the reporter answers matches #13805 handling — not an R6 hold.

**22:01:35Z reporter** ([cmt 6327515348](https://github.com/shader-slang/slang/issues/13823#issuecomment-6327515348)): not
working on a fix, go ahead with the diagnostic. Relayed verbatim to the triager. Fixer progress (its seq 9): 3 commits,
test 10/10, non-Metal output byte-identical; found the `createDynamicObject` and `throws` producers.

**22:03Z** (triager msg 28 → fixer msg 17): proceed with A, name those producers; corrected my "in-place refresh" plan to a
fresh delta. Accepted silently.

**22:24Z bot draft [#13843](https://github.com/shader-slang/slang/pull/13843)** @e46715d2c, mapped to the fixer; saipraveenb25
auto-assigned shepherd.

**22:25Z reporter opened [#13844](https://github.com/shader-slang/slang/pull/13844)** (16 bytes, +537/-53, 11 files, head
ddc7a0ad4) and asked us to hold the diagnostic draft ([cmt 6327907095](https://github.com/shader-slang/slang/issues/13823#issuecomment-6327907095)).
My msg to the triager: hold #13843 as draft, keep the mapping, post one fresh delta naming both options with no verdict,
send the [Triage Resolution] as PARKED. Created one-shot `rechase-13823-maintainer-2329` (10-28 12:00Z).

**22:29Z reporter closed #13844 unmerged** ([cmt 6327960236](https://github.com/shader-slang/slang/issues/13823#issuecomment-6327960236))
to keep it separate from #13755: now commit 557906ff6, 1 ahead / 0 behind #13755 head 86f2514cd. Told the triager the delta
must name the stacked commit, not #13844; widened the rechase to watch #13755 merging and a new reporter PR.

**22:36Z [Triage Resolution] PARKED** (triager msg 54): delta [cmt 6328073437](https://github.com/shader-slang/slang/issues/13823#issuecomment-6328073437)
(22:36:14Z) live — both options, #13844 closed, no verdict, @saipraveenb25 asked.

**22:56Z update** (triager msg 56; fixer [Fix Report] msg 20): #13843 +260/-6, 8 files; explanation cmt 6328175004. Full
suite: 3 fp8 CUDA failures, same on master. CI held at `wait-for-human-priority`.

**10-22 00:36Z R1** (slang-reviewer `sess-1792622853013-sh1poc`, [Report] msg 58): REQUEST_CHANGES, 0 bugs, 4-5 gaps — control
lanes pass on compile failure; the 4 `lowerResultType` scopes are inert; no witness-wrapper test; CPU drops the sampler half
(pre-existing). 15 probe shapes, 0 diffs over 4776 compiles. Remedies `remedy-test.patch` + `remedy-drop-result-scopes.patch`.
My call: applying them to the held draft is allowed (sent via the triager).

**00:39Z** (triager msg 66): CPU drop reproduced (`-target cpp`, master 23f8fbe9b + 2026.13.1), also for a plain `Sampler2D`
field; CUDA unaffected. Spot-checked origin/master ffbd1771e5; two dedup searches empty. **00:4xZ my call: file it**, no fixer.

**00:49Z filed [#13851](https://github.com/shader-slang/slang/issues/13851)** — [[project_13851_cpu_combined_sampler_anyvalue_bitcast]].

**00:59Z** (triager msg 70): R1 remedies pushed, head 81efc9ddf6 (00:53Z), 14/14 (master 4/14), `lowerResultType` back to
master, explanation comment names #13851 out of scope, R2 requested. Reviewer's "Metal segfault" = existing #13654 (a
`SamplerState`-only field compiles rc 0); nothing filed or posted.

**01:06Z R2 APPROVE 0/0/0** (reviewer msg 72): commits match the R1 patches; suites 3053/3053; Devin repeats only the E41014
wording flag. Nothing posted (0 PR reviews; delta still newest).

**01:10Z round-2 [Triage Resolution]** (triager msg 76; fixer [Fix Report] msg 28): fixed (diagnostic), PARKED. #13843 7 files,
+334/-6. Chain quiescent until a maintainer acts or 10-28.

**09:57:45Z reporter M4 test report** ([cmt 6337983099](https://github.com/shader-slang/slang/issues/13823#issuecomment-6337983099),
unedited, no mention): branch now 07f2d85dd = 557906ff6 + #13755's test-only ebc7691ab (`git ls-remote` confirms; #13755 head
now ebc7691ab). macOS 26.7.1 / Xcode 26.5: 6 new lanes pass (fail on master), incl. `-mtl` sampling through a handle rebuilt
from the AnyValue; `tests/metal` 326/327 (master 316/317); same 6 ray-query/slang-glslang failures on both. Not a summons: no
dispatch, no post, triager not woken; cmt 6328073437 still accurate (compare link follows the head). Updated the rechase with
the new head; one dashboard line.
