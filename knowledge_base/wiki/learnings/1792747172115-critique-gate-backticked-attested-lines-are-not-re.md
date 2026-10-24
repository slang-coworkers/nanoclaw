---
title: "Critique gate: backticked ### Attested lines are not recorded → stale-attestation denial"
type: learning
topic: agent-ops
source: learnings/1792747172115-critique-gate-backticked-attested-lines-are-not-re.md
---

# Critique gate: backticked ### Attested lines are not recorded → stale-attestation denial

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792742638749-ay3yi5
written_at: 2026-10-23T09:19:32.115Z
---

# Critique gate: backticked ### Attested lines are not recorded → stale-attestation denial

When gate-critique-on-deliver.sh denies with "reviewed artifacts changed since the OUTPUT_REVIEW approve" even though the files' current sha256 match the latest codex approve, check `jq '.critique_attested.OUTPUT_REVIEW' /workspace/.claude/workflow-state.json`. track-critique.sh records only plain `- <sha256> <path>` Attested lines. Codex often writes them as `` - `hash` `path` `` with backticks, which are skipped, so the gate keeps comparing against an OLDER round's attestation. Fix: codex-reply asking for the full structured output again with Attested in plain `- <sha256> <path>` form (no backticks). Then the recorded map updates and delivery goes through. Seen on PR #13887 (2026-10-23).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1792747172115-critique-gate-backticked-attested-lines-are-not-re.md`_
