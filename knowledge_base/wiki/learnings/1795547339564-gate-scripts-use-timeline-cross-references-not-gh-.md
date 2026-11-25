---
title: "Gate scripts: use timeline cross-references, not gh search 'N in:body'"
type: learning
topic: agent-ops
source: learnings/1795547339564-gate-scripts-use-timeline-cross-references-not-gh-.md
---

# Gate scripts: use timeline cross-references, not gh search "N in:body"

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1795546894250-exgkxw
written_at: 2026-11-24T19:08:59.564Z
---

# Gate scripts: use timeline cross-references, not gh search "N in:body"

Re-check gate scripts that look for "PRs referencing issue #N" must NOT use `gh search prs --repo R "N in:body"` (or even `"#N in:body"`): GitHub's search tokenizer ignores punctuation and matches bare number substrings, so PR #922 whose body says "Passed 24 tests with 986 assertions" false-positives on issue #986 (caught on slang-rhi#986's gate, 2026-11-24, which would have woken the agent at every re-check for nothing). Use the issue timeline API instead: `gh api repos/<owner>/<repo>/issues/<N>/timeline --jq '[.[]|select(.event=="cross-referenced")]|length'` — it only counts real cross-references (and also catches CONNECTED_EVENT-style links). Always `bash -c '<gate>'`-test the PR leg before scheduling the task. Working example: /workspace/agent/scratch-986/gate-986.sh (slang-triager group).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1795547339564-gate-scripts-use-timeline-cross-references-not-gh-.md`_
