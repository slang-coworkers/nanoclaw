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
Escalated once (dashboard msg 239, 10-15 12:11Z). No reply as of 11-06 00:00Z (dashboard rows seq 510588–511446).

**Interim run policy (from 10-15 18:00Z):** never fold the 1,118 NO-FRONTMATTER or the nested-type DOSSIERs (all are
dialect false positives). Each run, also run `tools/okf_synth.py.before-2039 scan`; fold only what it lists
(OVERSIZE / REVIEW / INDEX-STALE), plus any new-tool DOSSIER that is >= 12 KB with >= 8 H2, or has a dossier-shaped name,
and is not `okf_synth: exempt`. The 21 original real dossiers were all folded by 10-17; per-run fold history lives in
`/workspace/agent/tasks/okf-memory-synthesis-4fba.md`, not here.

**Fold rules learned 10-17 → 10-31:**
- Real offenders are almost always chain records or case logs that regrew from dated appends. Split them into a current-state
  record (state table, decisions, lessons) and a sibling `…_history` / `…-rechase-log` / `…_case_log`, and write in the record
  that new dated entries go to the sibling. When one file holds several issues, split it per issue.
- Siblings may still be writing the file: snapshot it, and swap in the split only after an md5 check against the snapshot.
  If a write landed mid-split, merge it first (10-30 #14055, 10-31 #13350).
- Neither tool flags folder `index.md` size, but `slang/index.md` reached ~79 KB on 11-01 because re-chase prompts append history into
  index rows. Trims hold every entry at <= 450 B (~105 KB at 11-06 00:00Z after trimming 8 regrown rows; growth is new chains) (one state line + link), so it has
  no slack left: from here its size tracks the number of chains, and only an entry that regrows past ~450 B is a target. Trim rows to one state line + a link once the detail is in the record, and point a re-chase prompt's
  "History:" at the chain record, never at an index.
- Verbatim raw memos >= 12 KB that are `resource:` targets (`slang/raw/`) get `type: source` + `okf_synth: exempt`, not a split;
  `slang/raw/index.md` states that rule. The new tool ignores `exempt` and still counts them as DOSSIER.
- Write split leaves with a top-level `type:` line followed by the usual `name`/`description`/`metadata` block, so both tools
  and `memcheck.py` read them as typed.
**ESCALATE now fires every run** through the *unchanged-top-offender* trigger (from 10-16 06:00Z), or the *backlog-not-shrinking* trigger, because each new exempt raw memo in `slang/raw/` adds a false DOSSIER (11-02 18:00Z). The top offender
is the false-positive `MEMORY-full-archive-2026-08-05.md` DOSSIER, so the trigger fires even while the backlog shrinks.
It is the same root cause as msg 239, and the owner already has it, so do not re-send. Re-escalate only if the owner
replies, or if a NEW real offender (not a dialect false positive) stays stuck for 3 runs.

**Still true:** SKILL.md's embedded `okf_synth.py` overwrites `/workspace/agent/tools/okf_synth.py` every run, and
the recurring task is `okf-memory-synthesis-*` gated by `okf_synth.py gate`. Groups that run it: fixer, triager, Main.

**History (2026-08-22, superseded):** `/home/node/.claude` is a per-agent-group `.claude-shared` mount; before the
repo copy existed, each group carried its own SKILL.md and Main could not file-copy fixes to peers
(`/workspace/extra/ephemeral/prod-groups` is read-only), so fixes were relayed as diffs.
