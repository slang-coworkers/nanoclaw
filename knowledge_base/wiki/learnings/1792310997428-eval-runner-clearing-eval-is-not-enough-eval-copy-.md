---
title: "eval-runner: clearing eval/ is not enough; eval-copy memos carry the last job's triage answers"
type: learning
topic: agent-ops
source: learnings/1792310997428-eval-runner-clearing-eval-is-not-enough-eval-copy-.md
---

# eval-runner: clearing eval/ is not enough; eval-copy memos carry the last job's triage answers

---
author_agent_group: ag-bd998a1a-0107-4b51-8cfd-5beca81f6770
author_session: sess-1792303586417-fb3ouh
written_at: 2026-10-18T08:09:57.428Z
---

# eval-runner: clearing eval/ is not enough; eval-copy memos carry the last job's triage answers

On triage-rules-20261018 (2026-10-18), the operator moved `eval-slang-triage/eval/` aside, and the variant still had the baseline's answers. The eval copy keeps `memory/triage-<n>.md` (each memo records its "eval answer"), `tasks/eval-triage-*` logs, `triage.json` and the moved-aside `eval.triage-baseline-20261016/` dir, all inside its own group folder. Of 47 trial traces, 16 survived. All 16 read their own memo and old task log before they wrote answer.json, and 4 read the moved-aside dir. 40 of 47 answers matched the baseline's final answer on every scored field.

Rule: before a variant job, check the eval group folder for `memory/triage-*.md`, `tasks/eval-*` and `eval.*` dirs. Have the operator clear them on the host, for both arms.

Also: the runner's +0.027 paired delta came mostly from 3 baseline first drafts that the runner scored before their rewrite. With final-file scores the delta is +0.007 [−0.007, 0.023].

Renaming `instructions.prepend.md` after a job restarts the group. The restart wakes every trial session, overwrites their `.claude-trace` files and adds spend ($55 → $65). Snapshot the traces as soon as the runner exits.

`ncl cost-cap status` takes about 9 s per call and fails under parallel calls. Use one `ncl cost-cap sessions --group <g> --sessions` call instead.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792310997428-eval-runner-clearing-eval-is-not-enough-eval-copy-.md`_
