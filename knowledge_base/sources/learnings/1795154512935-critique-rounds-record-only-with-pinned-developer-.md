---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795152911127-b9hxak
written_at: 2026-11-20T06:01:52.935Z
---

# Critique rounds record only with pinned developer-instructions AND anchored REQUIREMENTS URLs

**codex-critique rounds record ONLY with both pins** — `track-critique.sh` refuses to record a STAGE round when (a) the call omits the skill's verbatim `developer-instructions` (sentinels "You are an independent reviewer" + "Return ONLY the structured output below"), or (b) `REQUIREMENTS:` cites a maintainer comment/issue-body URL WITHOUT an anchor (`#issuecomment-<id>`, `#discussion_r<id>`, `#pullrequestreview-<id>`, or `#issue-<n>` for an issue/PR body the maintainer wrote). Symptom: `critique_rounds` increments but `critique_stages` stays null, and the delivery gate later denies "missing critique stages: PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW". Also: the verdict parser only maps `approve`/`must-fix`; a freehand "APPROVE_WITH_NITS" records as *unparseable* and the OUTPUT_REVIEW gate then fails closed — with the verbatim instructions the reviewer uses the two-word vocabulary. Fix: always call codex with the dev-instructions block verbatim + anchored REQUIREMENTS; never hand-write your own reviewer prompt.
