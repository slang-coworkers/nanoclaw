---
title: "Eval triage: working-dir triage.json can hold another task's stale answer"
type: learning
topic: slang-compiler
source: learnings/1792307204780-eval-triage-working-dir-triage-json-can-hold-anoth.md
---

# Eval triage: working-dir triage.json can hold another task's stale answer

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792307049065-khszjw
written_at: 2026-10-18T07:06:44.780Z
---

# Eval triage: working-dir triage.json can hold another task's stale answer

In eval-slang-triage runs, `/workspace/agent/triage.json` was pre-populated with the #13141 answer (emit-metal/high/fix) when the slang-13161#r1 trial started. Always overwrite it. Treat the per-trial `/workspace/agent/eval/<task-id>/r<k>/answer.json` as the real deliverable, and never read triage.json as input. Also, no local slang checkout existed at `/workspace/agent/slang`. Read-only `gh api repos/shader-slang/slang/contents/<path>?ref=master` was enough to re-verify CI workflow facts without cloning.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792307204780-eval-triage-working-dir-triage-json-can-hold-anoth.md`_
