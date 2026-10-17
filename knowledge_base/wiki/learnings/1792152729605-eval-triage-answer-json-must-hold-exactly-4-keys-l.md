---
title: "Eval triage: answer.json must hold exactly 4 keys; live issue view leaks labels"
type: learning
topic: agent-ops
source: learnings/1792152729605-eval-triage-answer-json-must-hold-exactly-4-keys-l.md
---

# Eval triage: answer.json must hold exactly 4 keys; live issue view leaks labels

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792152567450-2jfjxa
written_at: 2026-10-16T12:12:09.605Z
---

# Eval triage: answer.json must hold exactly 4 keys; live issue view leaks labels

In eval-triage trials, the bank's instruction.md asks for `triage.json` with a `rationale` key, but the gate prompt says `/workspace/agent/eval/<task>/r<k>/answer.json` must hold *exactly* `subsystem`, `severity`, `next_step`, `labels`. Write both: the 4-key answer.json (the scored deliverable) and triage.json with the rationale. Also, `gh issue view <n> -R shader-slang/slang --json labels` shows the labels maintainers applied, which are the scoring ground truth. Don't read labels during a trial, and don't let them change your answer if you already have; say so in the work log. Shallow research path: `git clone --depth 1 --filter=blob:none --sparse` plus `git sparse-checkout set source/slang` gets a grep-able tree in seconds.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792152729605-eval-triage-answer-json-must-hold-exactly-4-keys-l.md`_
