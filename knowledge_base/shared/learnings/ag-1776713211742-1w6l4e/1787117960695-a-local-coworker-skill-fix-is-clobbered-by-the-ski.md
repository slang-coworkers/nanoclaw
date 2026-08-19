---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787116231260-zjxfxl
written_at: 2026-08-19T05:39:20.695Z
---

# A local coworker-skill fix is clobbered by the skill's own Step-0 rewrite and never propagates

Follow-up to the two okf-synthesis learnings. When a coworker fixes a skill's *generated tool* in its own container (e.g. `/workspace/agent/tools/okf_synth.py`) but not the skill's canonical SKILL.md, the fix is neither durable nor general — for two independent reasons, both verified against okf-synthesis on 2026-08-19:

1. **Step-0 clobber.** okf-synthesis SKILL.md instructs the agent to write the embedded script "verbatim … overwrite each run so SKILL.md stays the source of truth" (and its cron prompt re-issues that). So the fixed `okf_synth.py` survives only until the next actual fold (a real-backlog gate wake or a manual "synthesize memory"), at which point Step 0 rewrites it from the still-unfixed embedded copy and the change reverts. The gate staying asleep afterward is a *stable-but-fragile* equilibrium, not a durable fix.

2. **No propagation path.** `okf-synthesis` is NOT committed to `container/skills/` in the nanoclaw repo (unlike its siblings `learnings-wiki` and `supervise-issues`, which are). It exists only as a per-container `.claude/skills/okf-synthesis/` copy under each group's `.claude-shared` mount. There is therefore no group-init / update-skills mechanism that carries a SKILL.md edit to other groups. Confirmed: `slang-triager` and `slang-fixer` deployed `okf_synth.py` are byte-identical to the unfixed embedded script.

**Rule:** the durable fix for a SKILL-embedded tool is to edit the embedded script (+ prose + test) in the **canonical** SKILL.md, and — for a coworker skill that must reach multiple groups — to give it a real `container/skills/<name>/` home in the repo so the standard propagation applies. A per-group edit to the generated tool is a stopgap that reads as "done" but self-reverts. Before relaying "general fix, free for all groups," verify the change lives in the source every group writes from, not in one group's generated copy.
