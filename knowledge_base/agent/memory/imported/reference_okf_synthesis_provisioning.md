---
name: okf-synthesis-provisioning
description: "Since 2026-10-15 the okf-synthesis skill ships from slang-coworkers/nanoclaw container/skills/ (ro /app/skills mount); re-provisioning dropped the local 08-22 classifier fix — fixes must land as a repo PR."
metadata: 
  node_type: memory
  type: reference
  originSessionId: a6095251-0434-402e-8497-1d80bc61de04
---

# okf-synthesis skill: repo-sourced since 2026-10-15 (was per-group, no repo source)

**Current (2026-10-15):** the skill now ships from the repo — `slang-coworkers/nanoclaw` `container/skills/okf-synthesis/`
(SKILL.md + `test_okf_synth.py`), bind-mounted **read-only** at `/app/skills/okf-synthesis` and copied to
`~/.claude/skills/okf-synthesis/` (md5 identical to `nv-main` after #2039 `a38cde5db`). So the old "no repo source"
gap is closed, and a local edit to SKILL.md is **overwritten on re-provision** — fixes must land as a repo PR.

⚠️ **Re-provisioning dropped the local classifier fix.** The repo SKILL.md never carried the 2026-08-22 fix
([[reference_okf_synth_classifier_fix]]); its embedded tool reads only top-level `^type:` and has no
`okf_synth: exempt`. Main's tree is 1,204/1,391 imported leaves in the nested `metadata.type` dialect, so the
10-15 run scanned 1,119 false NO-FRONTMATTER + 86 false DOSSIER (backlog 0 → 1,765,478) and printed a false
ESCALATE. The pre-#2039 tool is kept at `/workspace/agent/tools/okf_synth.py.before-2039` (it reads the same tree as
0 offenders). Owner decision pending: upstream the fix, or normalize every leaf to a top-level `type:` line.
Escalated once (dashboard msg 239, 10-15 12:11Z). No reply as of 10-31 00:00Z.

**Interim run policy (from 10-15 18:00Z):** never fold the 1,119 NO-FRONTMATTER or the nested-type DOSSIERs (all are
dialect false positives). Fold only the **dialect-independent** DOSSIERs: a file that is ≥12 KB with ≥8 H2 sections,
or has a dossier-shaped name, and is not `okf_synth: exempt`. The pre-#2039 tool listed these as informational REVIEW.
There were 21 of them, all folded over 10-15 18:00Z → 10-17 00:00Z (plus OVERSIZE splits of `slang/13654-…`, #13446, `slang/13544-…`). **0 real dialect-independent dossiers remain**; from now on only new real offenders (pre-#2039 REVIEW/OVERSIZE/INDEX-STALE) need folding. 10-17 06:00Z: the one such offender was `technique_find_the_owner_of_a_bot_filed_issue_before_dispatching` (16,043 B, regrown by per-case appends); split into the ladder (5.8 KB, lessons folded into rungs) and `technique_find_the_owner_of_a_bot_filed_issue_case_log` (4.8 KB). New cases go in the case log; if it nears 16 KB, prune old cases. 10-18 06:00Z: `orchestrator/supervise-tick-runbook.md` (15.2 KB, 8 H2, flagged REVIEW and DOSSIER by the new tool) had regrown through per-tick "Tick NNN notes" sections. I split it into the runbook (6.7 KB), `supervise-tick-pull-pitfalls.md` and `supervise-tick-degraded.md`, and added a rule that new lessons go into the sibling pages. 10-21 06:00Z: `feedback_issue_opened_webhook_is_not_evidence_the_issue_is_new` (12.1 KB, regrown by per-case appends, newly flagged DOSSIER) split into the rule (5.1 KB, cases folded into rungs 1–5) and `…_case_log` (4.4 KB); new cases go in the case log. 10-21 12:00Z: `slang/13423-metal-cb-scalar-layout` (12.8 KB, 11 H2 dated re-chase sections, REVIEW + new-tool DOSSIER) split into the chain record (5.9 KB: decisions, collision table, lessons) and `…-rechase-log` (3.6 KB); new re-chases append to the log. 10-22 00:00Z: two regrown OVERSIZE leaves folded — the webhook case log (16.8 KB → 6.6 KB: #13791 moved to terminal record `project_13791_windows_gpu_jobs_merge_back`, same-shape holds merged into batch entries) and `project_13771_metal_rwtexture_fence` (16.9 KB → 5.3 KB current state + `…_history` 5.0 KB). 10-22 12:00Z: `project_13823_metal_combined_sampler_handle_anyvalue` (16.0 KB, regrown by dated appends) → state table + decisions (4.8 KB) and `…_history` (6.1 KB, condensed to ids/times only); new dated entries append to the history. 10-27 12:00Z: `project_13876_non_overloadable_same_scope_redeclaration` (16.4 KB OVERSIZE, both tools) → state table + decisions + lessons (5.2 KB) and `…_history` (3.9 KB); same rule. 10-29 00:00Z: `project_13973_builtin_call_constant_fold` (25.1 KB OVERSIZE, both tools) → state table + pending decisions + lessons (5.9 KB) and `…_history` (6.4 KB); same rule. 10-29 18:00Z: `slang/13737-hlsl-combined-sampler-texture-only-ops` (17.0 KB OVERSIZE, both tools) → state table + fix + follow-ups + lessons (6.1 KB) and `slang/13737-hlsl-combined-sampler-history` (4.7 KB); same rule. 10-30 06:00Z: `slang/14055-parser-multiply-deref-pointer.md` (26.9 KB OVERSIZE, both tools, regrown by side-find appends while siblings were still writing it) split by subtopic: the #14055 record (6.9 KB), `slang/14078-pointer-emit-pr-stack.md` (#14078/82/84/87 + PRs) and `slang/14086-14089-pointer-semantics-parked.md`; swapped in only after an md5 check against a fresh snapshot (a sibling write landed mid-split and was merged). New side-find entries go in the sibling record. 10-30 12:00Z: neither tool flags folder `index.md` size, but `slang/index.md` is 77 KB; re-chase prompts were appending chain history into index rows (the #13169 row held 2.4 KB of #13301 state). Split that into `slang/13301-header-guard-slangpy-1204.md` and repointed `rechase-slangpy-1204-pr1-1158` there. When a re-chase prompt says "History: …index.md", point it at a chain record instead. 10-30 18:00Z: trimmed the #11709, #13654 and #13617 rows (3.9 KB → 1.2 KB; details already in the records, #13406 merge sha moved into the #11709 record, stale #13617 timer corrected to `af77`). 10-31 00:00Z: trimmed the #13737, #13732, #13590 and #14007 rows (`slang/index.md` 78.3 → 76.5 KB), after checking each id was already in its record. Write split leaves with a top-level `type:` line followed
by the usual `name`/`description`/`metadata` block, so both tools and `memcheck.py` read them as typed.
**ESCALATE now fires every run** through the *unchanged-top-offender* trigger, starting 10-16 06:00Z. The top offender
is the false-positive `MEMORY-full-archive-2026-08-05.md` DOSSIER, so the trigger fires even while the backlog shrinks.
It is the same root cause as msg 239, and the owner already has it, so do not re-send. Re-escalate only if the owner
replies, or if a NEW real offender (not a dialect false positive) stays stuck for 3 runs.

**Still true:** SKILL.md's embedded `okf_synth.py` overwrites `/workspace/agent/tools/okf_synth.py` every run, and
the recurring task is `okf-memory-synthesis-*` gated by `okf_synth.py gate`. Groups that run it: fixer, triager, Main.

**History (2026-08-22, superseded):** `/home/node/.claude` is a per-agent-group `.claude-shared` mount; before the
repo copy existed, each group carried its own SKILL.md and Main could not file-copy fixes to peers
(`/workspace/extra/ephemeral/prod-groups` is read-only), so fixes were relayed as diffs.
