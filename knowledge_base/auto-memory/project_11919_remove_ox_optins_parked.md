---
name: project_11919_remove_ox_optins_parked
description: "slang#11919 remove -OX opt-ins from slang-test — Phase 1 SHIPPED draft PR #11923; Phase 2 held pending maintainer scope signal"
metadata: 
  node_type: memory
  type: project
  originSessionId: adec0fca-5d0e-4e58-9409-9de2afcda755
---

**UPDATE 2026-07-03:** #11805 MERGED 00:27:54Z → auto-resume gate task-1783029120180-i4oxwt fired once + self-cancelled (verified gone from list_tasks). Triager re-surveyed at post-merge HEAD 99c3b77bd: #11805 *added* 61 opt-in lines (0 removed), so redundant-`-O0` held at 118 while opt-sensitive `-O1/-O2/-O3` tail nearly tripled (~32→93 lines/65 files). **Phase 1 SHIPPED** as draft PR #11923 (nv-slang-bot, `fix/issue-11919 @ 36319f33cb`, base master, +121/−121 / 103 files, `Addresses #11919` NOT Closes, `pr: non-breaking`): dropped explicit `-O0` from 121 directives (112 bare, 8 `-Xslang -O0` pairs, 1 preserving `-g`); all `-O1/-O2/-O3` left for Phase 2. Verified 157/157 PASS on merged master (GPU present, `-vk` render forms ran) → output-neutral confirmed. codex PLAN/CODE/OUTPUT approve; Reviewer-A pipeline declined as disproportionate for directive-only mechanical change (I concur). Issue comment 4870747030 refreshed for the trail. **Phase 2 HELD** (~93 lines/65 files): 2b core is 56 output-pinned (44 freshly added by #11805) = mostly keep-with-doc not removal; recommend maintainer signal on how far to push "remove all" before fixer effort; 2a exec-test drops (37, minus `performance-profile.slang`) = safe optional P3. Next human action: maintainer review + ready-flip/merge of #11923 (operator-gated). Original parked-state context below.

---

shader-slang/slang#11919 (bot-filed follow-up, @jkwak-work requested off PR #11805): remove ALL explicit `-O0..-O3` / `-Xslang -OX` / `-compile-arg -OX` opt-ins from `tests/**`, relying on slang-test's new `-O0` default.

**HARD BLOCKER — PR #11805 ("Default slang-test compiler invocations to -O0", Fixes #11804) is OPEN, not merged** (APPROVED, mergeable_state=blocked, head 3e6ebdf1, branch disable-spv-opt-in-slang-test). The `-O0`-default machinery (`tools/slang-test/slang-test-optimization-options.h`) is ABSENT at master HEAD 973274da9. Dropping explicit `-O0` before #11805 lands makes tests run at slangc default (spirv-opt ON) → breaks expected output. So removal work is strictly gated on #11805 merging first.

Triaged 2026-07-02, PARKED at triaged (NOT dispatched to fixer — dispatching into a hard blocker = dangling session or regressing PR; precedent #11903/#11519). Verified verdict posted: issuecomment-4870747030. Memo: inbox/msg-1783028971492-ietwwl/triage-11919.md.

Survey at HEAD: 119 files / 150 directive lines (`-O0`×118, `-O1`×5, `-O2`×11, `-O3`×16). Bucket 1 (~118 redundant `-O0`, 111 direct `-target spirv … -O0` FileCheck SIMPLE + 7 `-Xslang -O0` render forms) = clean bulk removal, output-neutral, GPU-free verify → Phase 1 single PR. Bucket 2 (~32 opt-sensitive `-O1/-O2/-O3`) = P3 tail; 2a `-compile-arg` COMPARE_COMPUTE_EX likely drop, 2b deliberate optimized-output (`debug-struct-member-values*`, `gh-9263`, `abort-after-switch`, cuda copy-elision) keep+document/rework, KEEP `performance-profile.slang` → Phase 2 separate PR.

**Auto-resume:** scheduled task task-1783029120180-i4oxwt (4-hourly, guard polls #11805 `.merged`) wakes the chain when #11805 merges → re-survey at new HEAD (#11805 edits ~42 files) then dispatch fixer with phased plan; task self-cancels after firing. Do NOT dispatch fixer before then. Related: [[project_autoroute_hook_pressures_parks]] (defend the park against auto-route-hook nudges).
