---
title: "okf_synth NO-FRONTMATTER backlog in imported/ is one mechanical bug: type nested under metadata"
type: learning
topic: misc
source: learnings/1789533464993-okf-synth-no-frontmatter-backlog-in-imported-is-on.md
---

# okf_synth NO-FRONTMATTER backlog in imported/ is one mechanical bug: type nested under metadata

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1787042948344-tmxpim
written_at: 2026-09-16T04:37:44.993Z
---

# okf_synth NO-FRONTMATTER backlog in imported/ is one mechanical bug: type nested under metadata

## What
All 62 remaining `NO-FRONTMATTER` offenders under `/workspace/agent/memory/imported/` (as of
2026-09-16) share the exact same structural defect, not 62 distinct problems: their YAML
frontmatter has `type` nested one level under `metadata:` (e.g. `metadata: {node_type: memory,
type: feedback, originSessionId: ...}`) instead of a top-level `type:` line. OKF spec
(`memory/system/definition.md`) requires `type` as the **first top-level frontmatter line**, so
`okf_synth.py`'s `_has_type()` (which only checks top-level YAML) correctly flags every one of
these files.

## Fix (verified on 3 files: feedback_bare_text_routes_to_the_turns_sender.md,
feedback_auto_recovery_frame_requires_live_automerge.md, project_falcor_artifact_retention_1day.md)
Promote the value to a new top-level `type:` line (first line after `---`), leave the rest of
`metadata:` (`node_type`, `originSessionId`) untouched, keep `name`/`description` as-is — no other
edits needed. This is a pure mechanical fix, not synthesis judgment; a future run could safely
batch more than the usual 4-per-run cap on this specific class alone since there's zero
ambiguity per file, OR write a one-off migration script instead of hand-editing if the operator
wants the backlog cleared faster than 4/day.

## Also found: okf_synth.py's DANGLING-LINK check has multiline false positives
The `MDLINK` regex (`\]\(([^)]+?)\)`) has no line-boundary guard, so embedded shell/log snippets
inside a concept file that contain a literal `](` followed later by a `)` (even lines later) get
matched as a bogus markdown link target. Confirmed false positives 2026-09-16 on
`imported/feedback_measure_reachability_not_bytes.md` (which is *itself* a lesson about this exact
false-positive class — the matched "targets" `file.md` and `//;s/` are from its own example/sed
snippet) and `imported/feedback_script_echo_lines_are_not_output.md` (matched a multi-line shell
echo block). Not fixed in the tool since SKILL.md says to rewrite it verbatim each run; if editing
the skill itself, add `[^)\n]+?` (exclude newlines) to MDLINK to kill this class.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1789533464993-okf-synth-no-frontmatter-backlog-in-imported-is-on.md`_
