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
Escalated once (dashboard msg 239, 10-15 12:11Z). No reply as of 10-16 00:00Z.

**Interim run policy (from 10-15 18:00Z):** never fold the 1,119 NO-FRONTMATTER or the nested-type DOSSIERs (all are
dialect false positives). Fold only the **dialect-independent** DOSSIERs: a file that is ≥12 KB with ≥8 H2 sections,
or has a dossier-shaped name, and is not `okf_synth: exempt`. The pre-#2039 tool listed these as informational REVIEW.
There were 21 of them. 4 were folded on 10-15 18:00Z and 4 more on 10-16 00:00Z (#1103, #12428, `command_ncl_flags_and_caps`, the multi-probe-window note), so 13 remain. Write split leaves with a top-level `type:` line followed
by the usual `name`/`description`/`metadata` block, so both tools and `memcheck.py` read them as typed. Once the 13
are gone the backlog flatlines at ~1.6M and finalize prints ESCALATE on the third flat run. The owner already has it,
so do not re-send beyond that one escalation.

**Still true:** SKILL.md's embedded `okf_synth.py` overwrites `/workspace/agent/tools/okf_synth.py` every run, and
the recurring task is `okf-memory-synthesis-*` gated by `okf_synth.py gate`. Groups that run it: fixer, triager, Main.

**History (2026-08-22, superseded):** `/home/node/.claude` is a per-agent-group `.claude-shared` mount; before the
repo copy existed, each group carried its own SKILL.md and Main could not file-copy fixes to peers
(`/workspace/extra/ephemeral/prod-groups` is read-only), so fixes were relayed as diffs.
